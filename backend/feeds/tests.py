from datetime import timedelta

from posts.models import Post
from profiles.models import Follow

LAPPEENRANTA = (28.0940, 61.0650)  # (lng, lat)
NEARBY = (28.1000, 61.0600)  # ~700 m away
HELSINKI = (24.9384, 60.1699)  # ~180 km away


def titles(response):
    return [item["title"] for item in response.json()["results"]]


def test_upcoming_lists_unfinished_events_soonest_first(api_client, user, make_event):
    organizer = user.profile
    make_event(organizer, title="later", starts_in=timedelta(days=3))
    make_event(organizer, title="ongoing", starts_in=-timedelta(hours=1))
    make_event(organizer, title="soon", starts_in=timedelta(hours=2))
    make_event(organizer, title="over", starts_in=-timedelta(days=1))

    response = api_client.get("/api/feeds/upcoming/")

    assert titles(response) == ["ongoing", "soon", "later"]


def test_nearby_filters_by_radius_and_sorts_by_distance(api_client, user, make_event):
    organizer = user.profile
    make_event(organizer, title="helsinki", at=HELSINKI)
    make_event(organizer, title="near", at=NEARBY)
    make_event(organizer, title="here", at=LAPPEENRANTA)
    make_event(organizer, title="online")

    lng, lat = LAPPEENRANTA
    response = api_client.get("/api/feeds/nearby/", {"lat": lat, "lng": lng, "radius_km": 5})

    assert titles(response) == ["here", "near"]
    assert 500 < response.json()["results"][1]["distance_m"] < 1000


def test_nearby_requires_a_position(api_client, db):
    assert api_client.get("/api/feeds/nearby/").status_code == 400


def test_following_feed_shows_own_and_followed_posts_newest_first(
    auth_client, user, make_user, make_organization
):
    club = make_organization("club")
    stranger = make_user().profile
    Follow.objects.create(follower=user.profile, followee=club)

    Post.objects.create(author=club, body="club post")
    Post.objects.create(author=stranger, body="stranger post")
    Post.objects.create(author=user.profile, body="my post")

    response = auth_client.get("/api/feeds/following/")

    assert [p["body"] for p in response.json()["results"]] == ["my post", "club post"]


def test_following_feed_requires_sign_in(api_client, db):
    assert api_client.get("/api/feeds/following/").status_code in (401, 403)


def test_upcoming_filters(api_client, user, make_event):
    from django.utils import timezone

    from events.models import Category

    games = Category.objects.get(slug="games")
    board = make_event(user.profile, title="board games", starts_in=timedelta(hours=2), price=0)
    board.categories.add(games)
    make_event(user.profile, title="paid concert", starts_in=timedelta(hours=3), price=15)
    make_event(user.profile, title="next week", starts_in=timedelta(days=7))

    def titles_for(**params):
        return titles(api_client.get("/api/feeds/upcoming/", params))

    assert titles_for(category=["games"]) == ["board games"]
    assert titles_for(category=["games", "music"]) == ["board games"]
    assert titles_for(free="true") == ["board games", "next week"]
    tomorrow = (timezone.now() + timedelta(days=1)).isoformat()
    assert titles_for(starts_before=tomorrow) == ["board games", "paid concert"]


def test_following_feed_shows_each_event_once(auth_client, user, make_user, make_event):
    friend = make_user().profile
    Follow.objects.create(follower=user.profile, followee=friend)
    party = make_event(friend, title="party")
    Post.objects.create(author=friend, event=party)
    Post.objects.create(author=friend, body="hello")
    Post.objects.create(author=user.profile, body="see you there!", event=party)

    posts = auth_client.get("/api/feeds/following/").json()["results"]

    assert [p["body"] for p in posts] == ["see you there!", "hello"]


def test_following_feed_can_hide_past_events(auth_client, user, make_event):
    over = make_event(user.profile, title="over", starts_in=-timedelta(days=2))
    soon = make_event(user.profile, title="soon")
    Post.objects.create(author=user.profile, event=over)
    Post.objects.create(author=user.profile, event=soon)
    Post.objects.create(author=user.profile, body="just text")

    def events(**params):
        posts = auth_client.get("/api/feeds/following/", params).json()["results"]
        return [p["event"]["title"] if p["event"] else p["body"] for p in posts]

    assert events() == ["just text", "soon", "over"]
    assert events(hide_past=True) == ["just text", "soon"]
