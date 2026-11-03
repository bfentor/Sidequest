import pytest

from config import fetch

from . import links
from .links import fetch_html, first_url, parse

PAGE = """<html><head>
<title>Fallback title</title>
<meta property="og:title" content="Sauna night">
<meta property="og:description" content="Bring a towel.">
<meta property="og:image" content="/img/sauna.jpg">
<meta property="og:site_name" content="Guild">
</head><body>…</body></html>"""


def test_first_url():
    assert first_url("See https://guild.fi/sauna. And http://other.fi") == "https://guild.fi/sauna"
    assert first_url("No links here") is None


def test_parse_reads_open_graph_tags():
    assert parse("https://guild.fi/events/1", PAGE) == {
        "title": "Sauna night",
        "description": "Bring a towel.",
        "image_url": "https://guild.fi/img/sauna.jpg",
        "site_name": "Guild",
    }
    plain = parse("https://guild.fi/", "<title> Just a title </title>")
    assert plain["title"] == "Just a title" and plain["site_name"] == "guild.fi"
    assert plain["image_url"] == ""


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/admin/",
        "http://10.0.0.5/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "https://example.com:8443/",
        "ftp://example.com/",
        "file:///etc/passwd",
    ],
)
def test_private_addresses_and_odd_ports_are_never_fetched(url, monkeypatch):
    def fail(*args, **kwargs):
        raise AssertionError("connected")

    monkeypatch.setattr(fetch.socket, "create_connection", fail)
    assert fetch_html(url) is None


def test_posts_get_a_cached_preview(auth_client, monkeypatch):
    fetched = []

    def fake_fetch(url):
        fetched.append(url)
        return url, PAGE

    monkeypatch.setattr(links, "fetch_html", fake_fetch)
    body = {"body": "Tonight: https://guild.fi/events/1"}
    first = auth_client.post("/api/posts/", body, format="json").json()
    second = auth_client.post("/api/posts/", body, format="json").json()

    assert first["link_preview"]["title"] == "Sauna night"
    assert second["link_preview"] == first["link_preview"]
    assert fetched == ["https://guild.fi/events/1"]

    edited = auth_client.patch(
        f"/api/posts/{first['id']}/", {"body": "No link any more"}, format="json"
    ).json()
    assert edited["link_preview"] is None
