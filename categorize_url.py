"""Deterministic, offline URL categorizer.

Categorizes a URL into a category using only domain and path rules -
no network calls, no AI. Meant as a first pass; more domains/paths can
be added to the tables below over time.
"""

import sys
from urllib.parse import urlsplit

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


def categorize(url):
    """Return a category label for the given URL, or "unknown"."""
    parts = urlsplit(url)
    domain = parts.netloc.lower()
    if domain.startswith("www."):
        domain = domain[len("www."):]

    if domain in DOMAIN_CATEGORIES:
        return DOMAIN_CATEGORIES[domain]

    path = parts.path.lower()
    if path.endswith(".pdf"):
        return "document"
    for hint, category in PATH_HINTS.items():
        if hint in path:
            return category

    return "unknown"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python categorize_url.py <url>")
        sys.exit(1)
    print(categorize(sys.argv[1]))
