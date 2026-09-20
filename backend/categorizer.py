"""Deterministic, offline URL classification for nibame.

The classifier uses URL structure and local rule data only. It never fetches
page content and never calls an AI service. The structured result explains the
rule that matched so the behavior stays inspectable.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import SplitResult, urlsplit, urlunsplit

BASE_DIR = Path(__file__).resolve().parent
RULES_PATH = BASE_DIR / "category_rules.json"
DEFAULT_CONFIG_PATH = BASE_DIR / "data" / "user_patterns.json"

DOMAIN_PATH_RULES = (
    ("linkedin.com", re.compile(r"^/jobs(?:/|$)"), "jobs_careers"),
    ("google.com", re.compile(r"^/maps(?:/|$)"), "travel_places"),
    ("google.com", re.compile(r"^/search(?:/|$)"), "search_discovery"),
)

PATH_HINTS = (
    (re.compile(r"/(?:jobs|careers|vacancies)(?:/|$)"), "jobs_careers"),
    (re.compile(r"/(?:maps|directions|places)(?:/|$)"), "travel_places"),
    (re.compile(r"/(?:watch|video|videos|reel|reels|shorts)(?:/|$)"), "video_streaming"),
)

FILE_EXTENSION_CATEGORIES = {
    ".pdf": "cloud_documents",
    ".doc": "cloud_documents",
    ".docx": "cloud_documents",
    ".ppt": "cloud_documents",
    ".pptx": "cloud_documents",
    ".xls": "cloud_documents",
    ".xlsx": "cloud_documents",
    ".csv": "cloud_documents",
    ".epub": "entertainment_books",
    ".mobi": "entertainment_books",
    ".mp3": "music_audio",
    ".wav": "music_audio",
    ".m4a": "music_audio",
    ".mp4": "video_streaming",
    ".mov": "video_streaming",
    ".webm": "video_streaming",
    ".ipynb": "development_code",
}


@dataclass(frozen=True)
class CategoryDefinition:
    """Display metadata and deterministic domains for one category."""

    id: str
    label: str
    description: str
    color: str
    domains: tuple[str, ...]


@dataclass(frozen=True)
class CategorizationResult:
    """Explainable result returned by the classifier and API."""

    input_url: str
    normalized_url: str
    domain: str
    category: str
    category_label: str
    description: str
    color: str
    matched_by: str
    matched_rule: str | None
    confidence: str
    is_valid: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class NormalizedUrl:
    url: str
    domain: str
    parsed: SplitResult


@lru_cache(maxsize=1)
def load_category_definitions() -> dict[str, CategoryDefinition]:
    """Load and validate category metadata from the repository rule file."""

    with RULES_PATH.open(encoding="utf-8") as rules_file:
        raw_rules = json.load(rules_file)

    definitions: dict[str, CategoryDefinition] = {}
    seen_domains: dict[str, str] = {}
    for category_id, raw_definition in raw_rules.items():
        domains = tuple(domain.lower().strip(".") for domain in raw_definition["domains"])
        for domain in domains:
            existing_category = seen_domains.get(domain)
            if existing_category is not None:
                raise ValueError(
                    f"duplicate domain rule {domain!r}: {existing_category!r} and {category_id!r}"
                )
            seen_domains[domain] = category_id

        definitions[category_id] = CategoryDefinition(
            id=category_id,
            label=raw_definition["label"],
            description=raw_definition["description"],
            color=raw_definition["color"],
            domains=domains,
        )

    if "unknown" not in definitions:
        raise ValueError("category rules must define an 'unknown' category")
    return definitions


def get_categories() -> list[CategoryDefinition]:
    """Return categories in their curated display order."""

    return list(load_category_definitions().values())


def _domain_index() -> list[tuple[str, str]]:
    definitions = load_category_definitions()
    rules = [
        (domain, category.id)
        for category in definitions.values()
        for domain in category.domains
    ]
    return sorted(rules, key=lambda item: len(item[0]), reverse=True)


def _normalize_domain(domain: str) -> str:
    normalized = domain.lower().rstrip(".")
    for prefix in ("www.", "m."):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    return normalized


def normalize_url(raw_url: str) -> NormalizedUrl | None:
    """Normalize an HTTP(S) URL, accepting a bare domain as user input."""

    candidate = raw_url.strip()
    if not candidate:
        return None

    if "://" not in candidate:
        candidate = f"https://{candidate}"

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return None

    if parsed.scheme.lower() not in {"http", "https"} or not hostname:
        return None

    domain = _normalize_domain(hostname)
    if not domain or any(character.isspace() for character in domain):
        return None

    netloc = domain
    if port and not (
        parsed.scheme.lower() == "http" and port == 80
        or parsed.scheme.lower() == "https" and port == 443
    ):
        netloc = f"{domain}:{port}"

    normalized_parsed = SplitResult(
        scheme=parsed.scheme.lower(),
        netloc=netloc,
        path=parsed.path or "/",
        query=parsed.query,
        fragment=parsed.fragment,
    )
    return NormalizedUrl(
        url=urlunsplit(normalized_parsed),
        domain=domain,
        parsed=normalized_parsed,
    )


def load_user_patterns(path: str | os.PathLike[str] = DEFAULT_CONFIG_PATH) -> dict[str, str]:
    """Return saved domain overrides, tolerating a missing config file."""

    config_path = Path(path)
    if not config_path.exists():
        return {}
    with config_path.open(encoding="utf-8") as config_file:
        raw_patterns = json.load(config_file)
    return {
        _normalize_domain(str(domain)): str(category)
        for domain, category in raw_patterns.items()
        if domain and category
    }


def save_user_patterns(
    patterns: Mapping[str, str], path: str | os.PathLike[str] = DEFAULT_CONFIG_PATH
) -> None:
    """Atomically persist user overrides to avoid partial JSON writes."""

    config_path = Path(path)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix="user-patterns-", suffix=".json", dir=config_path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as config_file:
            json.dump(dict(patterns), config_file, indent=2, sort_keys=True)
            config_file.write("\n")
        os.replace(temporary_path, config_path)
    except Exception:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)
        raise


def add_user_pattern(
    domain: str,
    category: str,
    path: str | os.PathLike[str] = DEFAULT_CONFIG_PATH,
) -> dict[str, str]:
    """Remember a manual domain override for future classifications."""

    normalized_input = normalize_url(domain)
    normalized_domain = normalized_input.domain if normalized_input else _normalize_domain(domain)
    if not normalized_domain or not category.strip():
        raise ValueError("domain and category are required")

    patterns = load_user_patterns(path)
    patterns[normalized_domain] = category.strip()
    save_user_patterns(patterns, path)
    return patterns


def _match_domain(domain: str, rules: Mapping[str, str] | list[tuple[str, str]]) -> tuple[str, str] | None:
    items = rules.items() if isinstance(rules, Mapping) else rules
    sorted_items = sorted(items, key=lambda item: len(item[0]), reverse=True)
    for candidate_domain, value in sorted_items:
        if domain == candidate_domain or domain.endswith(f".{candidate_domain}"):
            return candidate_domain, value
    return None


def _category_metadata(category_id: str) -> CategoryDefinition:
    definitions = load_category_definitions()
    if category_id in definitions:
        return definitions[category_id]
    return CategoryDefinition(
        id=category_id,
        label=category_id.replace("_", " ").title(),
        description="User-defined category.",
        color="#b29cff",
        domains=(),
    )


def _result(
    raw_url: str,
    normalized: NormalizedUrl | None,
    category_id: str,
    matched_by: str,
    matched_rule: str | None,
    confidence: str,
) -> CategorizationResult:
    category = _category_metadata(category_id)
    return CategorizationResult(
        input_url=raw_url,
        normalized_url=normalized.url if normalized else "",
        domain=normalized.domain if normalized else "",
        category=category.id,
        category_label=category.label,
        description=category.description,
        color=category.color,
        matched_by=matched_by,
        matched_rule=matched_rule,
        confidence=confidence,
        is_valid=normalized is not None,
    )


def categorize_url(
    url: str, user_patterns: Mapping[str, str] | None = None
) -> CategorizationResult:
    """Return an explainable category result without network access."""

    normalized = normalize_url(url)
    if normalized is None:
        return _result(url, None, "unknown", "invalid", None, "none")

    patterns = load_user_patterns() if user_patterns is None else dict(user_patterns)
    user_match = _match_domain(normalized.domain, patterns)
    if user_match:
        rule_domain, category_id = user_match
        return _result(url, normalized, category_id, "user_override", rule_domain, "high")

    path = normalized.parsed.path.lower()
    for rule_domain, pattern, category_id in DOMAIN_PATH_RULES:
        if (
            normalized.domain == rule_domain
            or normalized.domain.endswith(f".{rule_domain}")
        ) and pattern.search(path):
            return _result(
                url,
                normalized,
                category_id,
                "domain_path",
                f"{rule_domain}:{pattern.pattern}",
                "high",
            )

    domain_match = _match_domain(normalized.domain, _domain_index())
    if domain_match:
        rule_domain, category_id = domain_match
        confidence = "low" if category_id == "link_shortener" else "high"
        return _result(url, normalized, category_id, "domain", rule_domain, confidence)

    extension = Path(path).suffix.lower()
    if extension in FILE_EXTENSION_CATEGORIES:
        return _result(
            url,
            normalized,
            FILE_EXTENSION_CATEGORIES[extension],
            "file_extension",
            extension,
            "medium",
        )

    for pattern, category_id in PATH_HINTS:
        if pattern.search(path):
            return _result(
                url,
                normalized,
                category_id,
                "path",
                pattern.pattern,
                "medium",
            )

    return _result(url, normalized, "unknown", "fallback", None, "low")


def categorize(url: str, user_patterns: Mapping[str, str] | None = None) -> str:
    """Return only the category id for compatibility with the original CLI."""

    return categorize_url(url, user_patterns=user_patterns).category


def _run_cli(arguments: list[str]) -> int:
    if len(arguments) == 3 and arguments[1] == "--set":
        domain, category = arguments[2].split("=", 1)
        add_user_pattern(domain, category)
        print(f"saved: {_normalize_domain(domain)} -> {category}")
        return 0
    if len(arguments) == 2:
        print(json.dumps(categorize_url(arguments[1]).to_dict(), indent=2))
        return 0
    print("usage: python -m backend.categorizer <url>")
    print("       python -m backend.categorizer --set <domain>=<category>")
    return 1


if __name__ == "__main__":
    sys.exit(_run_cli(sys.argv))
