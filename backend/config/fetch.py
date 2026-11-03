"""Fetching web addresses people typed (link previews, calendar feeds) without being misused.

Fetching addresses from users is a classic way to make a server reach places
it shouldn't (server-side request forgery), so every request here, including
each redirect, goes only to public IP addresses on the standard ports, and
connects only to the addresses that were checked.
"""

import http.client
import ipaddress
import logging
import socket
import ssl
from urllib.parse import urljoin, urlsplit

logger = logging.getLogger(__name__)

USER_AGENT = "Sidequest (+https://sidequest.fentorweb.hu)"
TIMEOUT_SECONDS = 3
MAX_REDIRECTS = 3


class Blocked(Exception):
    """The address isn't one the server may fetch."""


def public_addresses(host, port):
    """The host's IP addresses (IPv4 first), if all are public; raises Blocked otherwise."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as error:
        raise Blocked(f"can't resolve {host}") from error
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(ipaddress.ip_address(a).is_global for a in addresses):
        raise Blocked(f"{host} isn't public")
    return sorted(addresses, key=lambda a: (ipaddress.ip_address(a).version, a))


def _connect(addresses, port, timeout):
    """A socket to the first of the checked addresses that answers (not every network has IPv6)."""
    error = OSError("no addresses")
    for address in addresses:
        try:
            return socket.create_connection((address, port), timeout)
        except OSError as failure:
            error = failure
    raise error


class _PinnedHTTPConnection(http.client.HTTPConnection):
    """Connects to checked IP addresses, whatever the host name resolves to by then."""

    def __init__(self, host, addresses, **kwargs):
        super().__init__(host, **kwargs)
        self.addresses = addresses

    def connect(self):
        self.sock = _connect(self.addresses, self.port, self.timeout)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, addresses, **kwargs):
        super().__init__(host, context=ssl.create_default_context(), **kwargs)
        self.addresses = addresses

    def connect(self):
        sock = _connect(self.addresses, self.port, self.timeout)
        # Certificates are still checked against the host name.
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def fetch_text(url, *, accept, kinds, max_bytes):
    """The document at `url` as (final URL, text), or None if it can't or mustn't be fetched.

    `kinds` are substrings one of which the response's Content-Type must
    contain (e.g. "html"); at most `max_bytes` are read.
    """
    for _ in range(MAX_REDIRECTS + 1):
        parts = urlsplit(url)
        default_port = {"http": 80, "https": 443}.get(parts.scheme)
        if default_port is None or not parts.hostname or parts.port not in (None, default_port):
            return None
        try:
            addresses = public_addresses(parts.hostname, default_port)
        except Blocked:
            return None
        connection_class = (
            _PinnedHTTPSConnection if parts.scheme == "https" else _PinnedHTTPConnection
        )
        connection = connection_class(parts.hostname, addresses, timeout=TIMEOUT_SECONDS)
        path = parts.path or "/"
        if parts.query:
            path += f"?{parts.query}"
        try:
            connection.request("GET", path, headers={"User-Agent": USER_AGENT, "Accept": accept})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308) and response.getheader("Location"):
                url = urljoin(url, response.getheader("Location"))
                continue
            content_type = response.getheader("Content-Type", "")
            if response.status != 200 or not any(kind in content_type for kind in kinds):
                return None
            body = response.read(max_bytes)
            charset = response.headers.get_content_charset() or "utf-8"
            return url, body.decode(charset, errors="replace")
        except (OSError, http.client.HTTPException, LookupError) as error:
            logger.info("Fetching %s failed: %s", url, error)
            return None
        finally:
            connection.close()
    return None
