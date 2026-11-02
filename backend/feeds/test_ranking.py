from datetime import timedelta

import pytest

from events.models import Attendance, Category
from profiles.models import Follow

from .tests import HELSINKI, LAPPEENRANTA, titles

GOING = Attendance.Status.GOING
INTERESTED = Attendance.Status.INTERESTED


@pytest.fixture
def host(make_organization):
    return make_organization("host")


def rsvp(event, *profiles, status=GOING):
    for profile in profiles:
        Attendance.objects.create(event=event, profile=profile, status=status)


def test_trending_ranks_by_recent_rsvps(api_client, host, make_user, make_event):
    people = [make_user().profile for _ in range(3)]
    quiet = make_event(host, title="quiet")
    buzzing = make_event(host, title="buzzing", starts_in=timedelta(days=3))
    curious = make_event(host, title="curious")
    make_event(host, title="nobody")
    rsvp(quiet, people[0])
    rsvp(buzzing, *people)
    rsvp(curious, *people, status=INTERESTED)

    old = Attendance.objects.filter(event=quiet)
    old.update(updated_at=old[0].updated_at - timedelta(days=30))

    assert titles(api_client.get("/api/feeds/trending/")) == ["buzzing", "curious"]


def test_for_you_weighs_interests_follows_and_friends(
    auth_client, user, host, make_user, make_event, make_organization
):
    me = user.profile
    me.interests.add(Category.objects.get(slug="games"))
    friend = make_user().profile
    shy_friend = make_user().profile
    shy_friend.hide_attendance = True
    shy_friend.save()
    for followee in (friend, shy_friend, host):
        Follow.objects.create(follower=me, followee=followee)
    stranger_org = make_organization("strangers")

    games = make_event(stranger_org, title="games")
    games.categories.add(Category.objects.get(slug="games"))
    make_event(host, title="followed host")
    with_friend = make_event(stranger_org, title="friend going")
    rsvp(with_friend, friend)
    shy = make_event(stranger_org, title="shy friend going")
    rsvp(shy, shy_friend)
    make_event(stranger_org, title="plain")
    answered = make_event(host, title="already answered")
    rsvp(answered, me)
    make_event(me, title="my own")

    ranked = titles(auth_client.get("/api/feeds/for-you/"))

    assert ranked[:3] == ["followed host", "games", "friend going"]
    # The shy friend's RSVP only counts as popularity, not as a friend going.
    assert ranked[3:] == ["shy friend going", "plain"]


def test_for_you_favours_nearby_events(auth_client, host, make_event):
    make_event(host, title="far", at=HELSINKI)
    make_event(host, title="online")
    make_event(host, title="here", at=LAPPEENRANTA, starts_in=timedelta(days=3))
    lng, lat = LAPPEENRANTA

    nearby_first = titles(auth_client.get("/api/feeds/for-you/", {"lat": lat, "lng": lng}))
    soonest_first = titles(auth_client.get("/api/feeds/for-you/"))

    assert nearby_first[0] == "here"
    assert soonest_first[-1] == "here"


def test_for_you_requires_sign_in_and_a_whole_position(api_client, auth_client, db):
    assert api_client.get("/api/feeds/for-you/").status_code in (401, 403)
    assert auth_client.get("/api/feeds/for-you/", {"lat": 61}).status_code == 400
