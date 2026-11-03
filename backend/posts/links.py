"""Link previews: the title, description and picture of the first web link in a post.

The page is fetched with config.fetch, which keeps people from using
previews to make the server reach private addresses.
"""

import re
from datetime import timedelta
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from django.utils import timezone

from config.fetch import fetch_text

from .models import LinkPreview

# The same as the app's link pattern (components/rich-text.tsx).
URL = re.compile(r"https?://[^\s<>]*[^\s<>.,;:!?)\]'\"]")
MAX_BYTES = 512 * 1024
# Cached previews older than this are fetched again when another post links there.
REFRESH_AFTER = timedelta(days=7)


def first_url(text):
    match = URL.search(text or "")
    return match.group(0) if match else None


def fetch_html(url):
    """The page at `url` as (final URL, HTML), or None."""
    return fetch_text(url, accept="text/html", kinds=("html",), max_bytes=MAX_BYTES)


class _MetaParser(HTMLParser):
    """Collects Open Graph tags, the description and the <title> from a page's head."""

    def __init__(self):
        super().__init__()
        self.meta = {}
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = (attrs.get("property") or attrs.get("name") or "").lower()
            if key and attrs.get("content") and key not in self.meta:
                self.meta[key] = attrs["content"].strip()
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def parse(url, html):
    """{"title", "description", "image_url", "site_name"} from a page; title is empty if none."""
    parser = _MetaParser()
    try:
        parser.feed(html)
    except Exception:  # Broken HTML: use what was read before it.
        pass
    meta = parser.meta
    image = meta.get("og:image") or meta.get("twitter:image")
    image = urljoin(url, image) if image else ""
    return {
        "title": (meta.get("og:title") or meta.get("twitter:title") or parser.title.strip())[:300],
        "description": (
            meta.get("og:description")
            or meta.get("description")
            or meta.get("twitter:description")
            or ""
        )[:500],
        "image_url": image[:2000] if urlsplit(image).scheme in ("http", "https") else "",
        "site_name": (meta.get("og:site_name") or urlsplit(url).hostname or "")[:100],
    }


def preview_for(url):
    """The (cached) LinkPreview for `url`, or None for no link or a page without a title."""
    if not url or len(url) > 2000:
        return None
    preview = LinkPreview.objects.filter(url=url).first()
    if preview is None or preview.fetched_at < timezone.now() - REFRESH_AFTER:
        fetched = fetch_html(url)
        details = (
            parse(*fetched)
            if fetched
            else {"title": "", "description": "", "image_url": "", "site_name": ""}
        )
        preview, _ = LinkPreview.objects.update_or_create(url=url, defaults=details)
    return preview if preview.title else None
