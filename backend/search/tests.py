from datetime import timedelta

from profiles.models import Profile


def search(client, q, **params):
    return client.get("/api/search/", {"q": q, **params}).json()


def test_finds_events_by_word_prefixes_and_typos(api_client, user, make_event):
    make_event(user.profile, title="Board game night", venue_name="Student union")
    make_event(user.profile, title="Morning run")
    make_event(user.profile, title="Board meeting", starts_in=-timedelta(days=3))

    assert [e["title"] for e in search(api_client, "boar gam")["events"]] == ["Board game night"]
    assert [e["title"] for e in search(api_client, "boardgame nigth")["events"]] == [
        "Board game night"
    ]
    assert [e["title"] for e in search(api_client, "union")["events"]] == ["Board game night"]
    past = search(api_client, "meeting", include_past="true")["events"]
    assert [e["title"] for e in past] == ["Board meeting"]


def test_finds_profiles_by_name_or_handle(api_client, make_user, make_organization):
    club = make_organization("chess_club")
    Profile.objects.filter(pk=club.pk).update(display_name="Lappeenranta Chess Club", verified=True)

    assert [p["handle"] for p in search(api_client, "chess")["profiles"]] == ["chess_club"]
    assert [p["handle"] for p in search(api_client, "@chess_cl")["profiles"]] == ["chess_club"]
    assert [p["handle"] for p in search(api_client, "Lapenranta")["profiles"]] == ["chess_club"]


def test_hides_what_the_viewer_may_not_see(auth_client, user, make_user, make_event):
    from moderation.services import block

    other = make_user()
    make_event(other.profile, title="Secret party")
    block(user.profile, other.profile)

    assert search(auth_client, "party")["events"] == []


def test_ignores_query_syntax(api_client, db):
    assert search(api_client, "a & | ! :* (")["events"] == []
