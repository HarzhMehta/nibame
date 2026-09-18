"""Deterministic, offline URL categorizer.

Categorizes a URL into a category using domain and path rules only -
no network calls, no AI. User-assigned domain -> category mappings are
stored in a JSON config so a manual override is remembered next time.
"""

import json
import os
import sys
from urllib.parse import urlsplit

CATEGORIES = [
    "video",
    "code",
    "article",
    "social",
    "music",
    "shopping",
    "document",
    "unknown",
]

# domain -> category. Checked against the netloc, stripped of "www.".
DOMAIN_CATEGORIES = {
    "youtube.com": "video",
    "youtu.be": "video",
    "vimeo.com": "video",
    "github.com": "code",
    "gitlab.com": "code",
    "bitbucket.org": "code",
    "instagram.com": "social",
    "tiktok.com": "social",
    "twitter.com": "social",
    "x.com": "social",
    "open.spotify.com": "music",
    "soundcloud.com": "music",
    "medium.com": "article",
    "substack.com": "article",
    "amazon.com": "shopping",
    "ebay.com": "shopping",
}

# path substring -> category, used when the domain isn't recognized.
PATH_HINTS = {
    "/reel/": "video",
    "/shorts/": "video",
}

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "user_patterns.json")


def _normalize_domain(url):
    domain = urlsplit(url).netloc.lower()
    if domain.startswith("www."):
        domain = domain[len("www."):]
    return domain


def load_user_patterns(path=DEFAULT_CONFIG_PATH):
    """Return the saved domain -> category overrides, or {} if none yet."""
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def save_user_patterns(patterns, path=DEFAULT_CONFIG_PATH):
    with open(path, "w") as f:
        json.dump(patterns, f, indent=2, sort_keys=True)


def add_user_pattern(domain, category, path=DEFAULT_CONFIG_PATH):
    """Record a manual override so future URLs on this domain auto-categorize.

    The category can be one of the built-in CATEGORIES or a new,
    user-defined keyword (e.g. "news") - manual overrides aren't
    limited to the fixed set.
    """
    if not domain or not category:
        raise ValueError("domain and category are required")

    domain = domain.lower()
    if domain.startswith("www."):
        domain = domain[len("www."):]

    patterns = load_user_patterns(path)
    patterns[domain] = category
    save_user_patterns(patterns, path)
    return patterns


def categorize(url, user_patterns=None):
    """Return a category label for the given URL, or "unknown".

    User-defined patterns (manual overrides) take priority over the
    built-in domain table, since they represent an explicit choice.
    """
    if user_patterns is None:
        user_patterns = load_user_patterns()

    domain = _normalize_domain(url)

    if domain in user_patterns:
        return user_patterns[domain]

    if domain in DOMAIN_CATEGORIES:
        return DOMAIN_CATEGORIES[domain]

    path = urlsplit(url).path.lower()
    if path.endswith(".pdf"):
        return "document"
    for hint, category in PATH_HINTS.items():
        if hint in path:
            return category

    return "unknown"


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--set":
        # python categorizer.py --set news.ycombinator.com=article
        domain, category = sys.argv[2].split("=", 1)
        add_user_pattern(domain, category)
        print(f"saved: {domain} -> {category}")
    elif len(sys.argv) == 2:
        print(categorize(sys.argv[1]))
    else:
        print("usage: python categorizer.py <url>")
        print("       python categorizer.py --set <domain>=<category>")
        sys.exit(1)
