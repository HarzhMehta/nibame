"""Deterministic HTML/OG metadata extraction for nibame.

Fetches a single HTTP(S) URL (bounded timeout, bounded body size,
SSRF-guarded) and extracts og:title/og:description/og:image with generic
HTML fallbacks (<title>, <meta name="description">, first meaningful <p>).
No domain-specific logic, no AI calls -- the same extractor runs on every
site.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import socket
import sys
from dataclasses import asdict, dataclass
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from backend.categorizer import normalize_url

USER_AGENT = "nibame-metadata-bot/0.1 (+https://github.com/ekansh-exe/nibame)"
REQUEST_TIMEOUT_SECONDS = 5.0
MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MiB cap on downloaded body
MAX_REDIRECTS = 3
ALLOWED_CONTENT_TYPES = ("text/html", "application/xhtml+xml")
MIN_FALLBACK_PARAGRAPH_CHARS = 60


@dataclass(frozen=True)
class MetadataResult:
    """Explainable metadata result returned by the extractor and API."""

    input_url: str
    normalized_url: str
    domain: str
    is_valid: bool
    fetch_ok: bool
    failure_reason: str | None
    status_code: int | None
    title: str | None
    title_source: str
    description: str | None
    description_source: str
    image: str | None
    image_source: str
    site_name: str | None
    site_name_source: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class _ExtractedFields:
    title: str | None
    title_source: str
    description: str | None
    description_source: str
    image: str | None
    image_source: str
    site_name: str | None
    site_name_source: str


def _is_safe_host(hostname: str) -> bool:
    """Reject hostnames that resolve to a private/loopback/link-local address."""

    try:
        addresses = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False

    for family_info in addresses:
        raw_address = family_info[4][0]
        try:
            address = ipaddress.ip_address(raw_address)
        except ValueError:
            return False
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
            or address.is_unspecified
        ):
            return False
    return True


def _empty_fields() -> _ExtractedFields:
    return _ExtractedFields(
        title=None,
        title_source="missing",
        description=None,
        description_source="missing",
        image=None,
        image_source="missing",
        site_name=None,
        site_name_source="missing",
    )


def _meta_content(soup: BeautifulSoup, **attrs: str) -> str | None:
    tag = soup.find("meta", attrs=attrs)
    if tag is None:
        return None
    content = tag.get("content")
    if content is None:
        return None
    content = content.strip()
    return content or None


def extract_metadata_from_html(html: str, page_url: str) -> _ExtractedFields:
    """Pure function: parse HTML and apply the OG/fallback extraction chain."""

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return _empty_fields()

    title = _meta_content(soup, property="og:title")
    title_source = "og"
    if title is None:
        if soup.title is not None and soup.title.string:
            title = soup.title.string.strip() or None
        title_source = "html_fallback" if title else "missing"

    description = _meta_content(soup, property="og:description")
    description_source = "og"
    if description is None:
        description = _meta_content(soup, name="description")
        description_source = "html_fallback" if description else "missing"
    if description is None:
        for paragraph in soup.find_all("p"):
            text = paragraph.get_text(strip=True)
            if len(text) >= MIN_FALLBACK_PARAGRAPH_CHARS:
                description = text
                description_source = "html_fallback"
                break
        else:
            description_source = "missing"

    image = _meta_content(soup, property="og:image")
    image_source = "missing"
    if image:
        image = urljoin(page_url, image)
        image_source = "og"
    else:
        image = None

    site_name = _meta_content(soup, property="og:site_name")
    site_name_source = "og" if site_name else "missing"

    return _ExtractedFields(
        title=title,
        title_source=title_source,
        description=description,
        description_source=description_source,
        image=image,
        image_source=image_source,
        site_name=site_name,
        site_name_source=site_name_source,
    )


def _result(
    raw_url: str,
    normalized_url: str,
    domain: str,
    *,
    is_valid: bool,
    fetch_ok: bool,
    failure_reason: str | None,
    status_code: int | None = None,
    fields: _ExtractedFields | None = None,
) -> MetadataResult:
    resolved_fields = fields if fields is not None else _empty_fields()
    return MetadataResult(
        input_url=raw_url,
        normalized_url=normalized_url,
        domain=domain,
        is_valid=is_valid,
        fetch_ok=fetch_ok,
        failure_reason=failure_reason,
        status_code=status_code,
        title=resolved_fields.title,
        title_source=resolved_fields.title_source,
        description=resolved_fields.description,
        description_source=resolved_fields.description_source,
        image=resolved_fields.image,
        image_source=resolved_fields.image_source,
        site_name=resolved_fields.site_name,
        site_name_source=resolved_fields.site_name_source,
    )


def _content_type_allowed(response: httpx.Response) -> bool:
    content_type = response.headers.get("content-type", "")
    media_type = content_type.split(";", 1)[0].strip().lower()
    return media_type in ALLOWED_CONTENT_TYPES


async def _read_bounded_text(response: httpx.Response) -> str | None:
    """Read the response body, aborting once MAX_RESPONSE_BYTES is exceeded."""

    chunks: list[bytes] = []
    total_bytes = 0
    async for chunk in response.aiter_bytes():
        total_bytes += len(chunk)
        if total_bytes > MAX_RESPONSE_BYTES:
            return None
        chunks.append(chunk)
    body = b"".join(chunks)
    return body.decode(response.encoding or "utf-8", errors="replace")


async def fetch_metadata_async(
    url: str, *, client: httpx.AsyncClient | None = None
) -> MetadataResult:
    """Validate, SSRF-check, fetch, and parse metadata for a single URL."""

    normalized = normalize_url(url)
    if normalized is None:
        return _result(url, "", "", is_valid=False, fetch_ok=False, failure_reason="invalid_url")

    owns_client = client is None
    active_client = client or httpx.AsyncClient(
        timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS),
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT},
    )

    try:
        current_url = normalized.url
        current_domain = normalized.domain
        for _hop in range(MAX_REDIRECTS + 1):
            hostname = urlsplit(current_url).hostname or ""
            if not _is_safe_host(hostname):
                return _result(
                    url,
                    normalized.url,
                    normalized.domain,
                    is_valid=False,
                    fetch_ok=False,
                    failure_reason="blocked_host",
                )

            try:
                async with active_client.stream("GET", current_url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            return _result(
                                url,
                                normalized.url,
                                current_domain,
                                is_valid=True,
                                fetch_ok=False,
                                failure_reason="http_error",
                                status_code=response.status_code,
                            )
                        next_normalized = normalize_url(urljoin(current_url, location))
                        if next_normalized is None:
                            return _result(
                                url,
                                normalized.url,
                                current_domain,
                                is_valid=False,
                                fetch_ok=False,
                                failure_reason="blocked_host",
                            )
                        current_url = next_normalized.url
                        current_domain = next_normalized.domain
                        continue

                    if response.status_code != 200:
                        return _result(
                            url,
                            normalized.url,
                            current_domain,
                            is_valid=True,
                            fetch_ok=False,
                            failure_reason="http_error",
                            status_code=response.status_code,
                        )

                    if not _content_type_allowed(response):
                        return _result(
                            url,
                            normalized.url,
                            current_domain,
                            is_valid=True,
                            fetch_ok=False,
                            failure_reason="unsupported_content_type",
                            status_code=response.status_code,
                        )

                    text = await _read_bounded_text(response)
                    if text is None:
                        return _result(
                            url,
                            normalized.url,
                            current_domain,
                            is_valid=True,
                            fetch_ok=False,
                            failure_reason="response_too_large",
                            status_code=response.status_code,
                        )

                    fields = extract_metadata_from_html(text, current_url)
                    return _result(
                        url,
                        normalized.url,
                        current_domain,
                        is_valid=True,
                        fetch_ok=True,
                        failure_reason=None,
                        status_code=response.status_code,
                        fields=fields,
                    )
            except httpx.TimeoutException:
                return _result(
                    url,
                    normalized.url,
                    current_domain,
                    is_valid=True,
                    fetch_ok=False,
                    failure_reason="timeout",
                )
            except httpx.HTTPError:
                return _result(
                    url,
                    normalized.url,
                    current_domain,
                    is_valid=True,
                    fetch_ok=False,
                    failure_reason="http_error",
                )
            except (UnicodeDecodeError, ValueError):
                return _result(
                    url,
                    normalized.url,
                    current_domain,
                    is_valid=True,
                    fetch_ok=False,
                    failure_reason="parse_error",
                )

        return _result(
            url,
            normalized.url,
            current_domain,
            is_valid=True,
            fetch_ok=False,
            failure_reason="redirect_limit_exceeded",
        )
    finally:
        if owns_client:
            await active_client.aclose()


def fetch_metadata(url: str) -> MetadataResult:
    """Synchronous entry point for the CLI."""

    return asyncio.run(fetch_metadata_async(url))


def _run_cli(arguments: list[str]) -> int:
    if len(arguments) == 2:
        result = fetch_metadata(arguments[1])
        print(json.dumps(result.to_dict(), indent=2))
        return 0
    print("usage: python -m backend.metadata <url>")
    return 1


if __name__ == "__main__":
    sys.exit(_run_cli(sys.argv))
