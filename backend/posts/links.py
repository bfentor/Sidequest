"""Link previews: the title, description and picture of the first web link in a post.

Fetching addresses people typed is a classic way to make a server reach
places it shouldn't (server-side request forgery), so every request here,
including each redirect, goes only to public IP addresses on the standard
ports, and connects to exactly the address that was checked.
"""

import http.client
import ipaddress
import logging
import re
import socket
import ssl
from datetime import timedelta
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from django.utils import timezone

from .models import LinkPreview

logger = logging.getLogger(__name__)

# The same as the app's link pattern (components/rich-text.tsx).
URL = re.compile(r"https?://[^\s<>]*[^\s<>.,;:!?)\]'\"]")
USER_AGENT = "Sidequest link previews (+https://sidequest.fentorweb.hu)"
TIMEOUT_SECONDS = 3
MAX_BYTES = 512 * 1024
MAX_REDIRECTS = 3
# Cached previews older than this are fetched again when another post links there.
REFRESH_AFTER = timedelta(days=7)


class Blocked(Exception):
    """The address isn't one link previews may fetch."""


def first_url(text):
    match = URL.search(text or "")
    return match.group(0) if match else None


def public_address(host, port):
    """One of the host's IP addresses, if all of them are public; raises Blocked otherwise."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as error:
        raise Blocked(f"can't resolve {host}") from error
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(ipaddress.ip_address(a).is_global for a in addresses):
        raise Blocked(f"{host} isn't public")
    return sorted(addresses)[0]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    """Connects to a checked IP address, whatever the host name resolves to by then."""

    def __init__(self, host, address, **kwargs):
        super().__init__(host, **kwargs)
        self.address = address

    def connect(self):
        self.sock = socket.create_connection((self.address, self.port), self.timeout)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, address, **kwargs):
        super().__init__(host, context=ssl.create_default_context(), **kwargs)
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, self.port), self.timeout)
        # Certificates are still checked against the host name.
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def fetch_html(url):
    """The page at `url` as (final URL, HTML), or None if it can't or mustn't be fetched."""
    for _ in range(MAX_REDIRECTS + 1):
        parts = urlsplit(url)
        default_port = {"http": 80, "https": 443}.get(parts.scheme)
        if default_port is None or not parts.hostname or parts.port not in (None, default_port):
            return None
        try:
            address = public_address(parts.hostname, default_port)
        except Blocked:
            return None
        connection_class = (
            _PinnedHTTPSConnection if parts.scheme == "https" else _PinnedHTTPConnection
        )
        connection = connection_class(parts.hostname, address, timeout=TIMEOUT_SECONDS)
        path = parts.path or "/"
        if parts.query:
            path += f"?{parts.query}"
        try:
            connection.request(
                "GET", path, headers={"User-Agent": USER_AGENT, "Accept": "text/html"}
            )
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308) and response.getheader("Location"):
                url = urljoin(url, response.getheader("Location"))
                continue
            content_type = response.getheader("Content-Type", "")
            if response.status != 200 or "html" not in content_type:
                return None
            body = response.read(MAX_BYTES)
            charset = response.headers.get_content_charset() or "utf-8"
            return url, body.decode(charset, errors="replace")
        except (OSError, http.client.HTTPException, LookupError) as error:
            logger.info("Link preview of %s failed: %s", url, error)
            return None
        finally:
            connection.close()
    return None


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
