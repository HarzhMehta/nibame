"""Tests for backend.metadata. Run with:

    pip install -r backend/requirements-dev.txt
    pytest backend/tests/test_metadata.py -v

All HTTP calls are mocked via respx -- no real network access is used.
"""

from __future__ import annotations

import socket
from unittest.mock import patch

import httpx
import pytest
import respx

from backend.metadata import MAX_RESPONSE_BYTES, fetch_metadata_async

pytestmark = pytest.mark.asyncio

OG_HTML = """
<html><head>
<meta property="og:title" content="Example Title" />
<meta property="og:description" content="Example description." />
<meta property="og:image" content="/img/cover.png" />
<meta property="og:site_name" content="Example Site" />
<title>Fallback title</title>
</head><body></body></html>
"""

FALLBACK_HTML = """
<html><head>
<title>Plain Title</title>
<meta name="description" content="Plain meta description." />
</head><body>
<p>This paragraph is long enough to be used as a fallback description for the page.</p>
</body></html>
"""

EMPTY_HTML = "<html><head></head><body></body></html>"

MALFORMED_HTML = "<html><head><title>Broken<body><p>unterminated tags everywhere"


def _local_getaddrinfo_for(blocked_ip: str):
    def _fake(host, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (blocked_ip, 0))]

    return _fake


async def test_invalid_url_short_circuits():
    with respx.mock:
        result = await fetch_metadata_async("not a url")
    assert result.is_valid is False
    assert result.failure_reason == "invalid_url"
    assert result.fetch_ok is False


@respx.mock
async def test_og_tags_present():
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=OG_HTML)
    )
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is True
    assert result.title == "Example Title"
    assert result.title_source == "og"
    assert result.description == "Example description."
    assert result.description_source == "og"
    assert result.image == "https://example.com/img/cover.png"
    assert result.image_source == "og"
    assert result.site_name == "Example Site"
    assert result.site_name_source == "og"


@respx.mock
async def test_html_fallback_chain():
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=FALLBACK_HTML)
    )
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is True
    assert result.title == "Plain Title"
    assert result.title_source == "html_fallback"
    assert result.description == "Plain meta description."
    assert result.description_source == "html_fallback"
    assert result.image is None
    assert result.image_source == "missing"


@respx.mock
async def test_no_metadata_present():
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=EMPTY_HTML)
    )
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is True
    assert result.title is None and result.title_source == "missing"
    assert result.description is None and result.description_source == "missing"
    assert result.image is None and result.image_source == "missing"
    assert result.site_name is None and result.site_name_source == "missing"


@respx.mock
async def test_malformed_html_does_not_raise():
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=MALFORMED_HTML)
    )
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is True


@respx.mock
async def test_oversized_response():
    oversized_body = "<html><body><p>" + ("a" * (MAX_RESPONSE_BYTES + 1024)) + "</p></body></html>"
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=oversized_body)
    )
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is False
    assert result.failure_reason == "response_too_large"


@respx.mock
async def test_timeout():
    respx.get("https://example.com/").mock(side_effect=httpx.TimeoutException("timed out"))
    result = await fetch_metadata_async("https://example.com/")
    assert result.fetch_ok is False
    assert result.failure_reason == "timeout"


@respx.mock
async def test_unsupported_content_type():
    respx.get("https://example.com/file.pdf").mock(
        return_value=httpx.Response(200, headers={"content-type": "application/pdf"}, content=b"%PDF-1.4")
    )
    result = await fetch_metadata_async("https://example.com/file.pdf")
    assert result.fetch_ok is False
    assert result.failure_reason == "unsupported_content_type"


@respx.mock
async def test_http_error_status():
    respx.get("https://example.com/missing").mock(return_value=httpx.Response(404))
    result = await fetch_metadata_async("https://example.com/missing")
    assert result.fetch_ok is False
    assert result.failure_reason == "http_error"
    assert result.status_code == 404


@respx.mock
async def test_relative_image_resolved_to_absolute():
    respx.get("https://example.com/post").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=OG_HTML)
    )
    result = await fetch_metadata_async("https://example.com/post")
    assert result.image == "https://example.com/img/cover.png"


@respx.mock
async def test_redirect_followed_once():
    respx.get("https://example.com/old").mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/new"})
    )
    respx.get("https://example.com/new").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/html"}, text=OG_HTML)
    )
    result = await fetch_metadata_async("https://example.com/old")
    assert result.fetch_ok is True
    assert result.title == "Example Title"


@respx.mock
async def test_redirect_limit_exceeded():
    respx.get("https://example.com/a").mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/b"})
    )
    respx.get("https://example.com/b").mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/c"})
    )
    respx.get("https://example.com/c").mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/d"})
    )
    respx.get("https://example.com/d").mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/e"})
    )
    result = await fetch_metadata_async("https://example.com/a")
    assert result.fetch_ok is False
    assert result.failure_reason == "redirect_limit_exceeded"


async def test_ssrf_blocked_private_ip():
    with patch("backend.metadata.socket.getaddrinfo", side_effect=_local_getaddrinfo_for("127.0.0.1")):
        with respx.mock as router:
            result = await fetch_metadata_async("https://internal.example.com/")
            assert router.calls.call_count == 0
    assert result.is_valid is False
    assert result.failure_reason == "blocked_host"


async def test_ssrf_blocked_metadata_ip():
    with patch(
        "backend.metadata.socket.getaddrinfo",
        side_effect=_local_getaddrinfo_for("169.254.169.254"),
    ):
        with respx.mock as router:
            result = await fetch_metadata_async("https://cloud-meta.example.com/")
            assert router.calls.call_count == 0
    assert result.is_valid is False
    assert result.failure_reason == "blocked_host"


@respx.mock
async def test_ssrf_blocked_via_redirect():
    respx.get("https://example.com/redirect-to-internal").mock(
        return_value=httpx.Response(302, headers={"location": "http://169.254.169.254/secret"})
    )
    result = await fetch_metadata_async("https://example.com/redirect-to-internal")
    assert result.is_valid is False
    assert result.failure_reason == "blocked_host"
