from datetime import timedelta

import pytest
from django.utils import timezone

from events.models import CoHost, Event
from events.services import publish_due
from notifications.models import Notification
from posts.models import Post
from profiles.models import Follow

EVENT = {
    "title": "Board game night",
    "starts_at": "2030-01-10T18:00:00Z",
    "ends_at": "2030-01-10T22:00:00Z",
}


@pytest.fixture
def fan(user, make_user):
    """Someone following the signed-in user."""
    fan = make_user()
    Follow.objects.create(follower=fan.profile, followee=user.profile)
    return fan


def upcoming_titles(client):
    return [e["title"] for e in client.get("/api/feeds/upcoming/").json()["results"]]


def test_draft_is_hidden_until_published(auth_client, api_client, fan):
    event_id = auth_client.post(
        "/api/events/", {**EVENT, "published_at": None}, format="json"
    ).json()["id"]

    api_client.force_authenticate(fan)
    assert upcoming_titles(api_client) == []
    assert api_client.get(f"/api/events/{event_id}/").status_code == 404
    assert auth_client.get(f"/api/events/{event_id}/").status_code == 200  # the organizer
    assert not Notification.objects.exists()

    auth_client.patch(
        f"/api/events/{event_id}/", {"published_at": timezone.now().isoformat()}, format="json"
    )
    assert upcoming_titles(api_client) == ["Board game night"]
    assert Notification.objects.get(recipient=fan).kind == "new_event"
    assert Post.objects.filter(event_id=event_id).count() == 1


def test_scheduled_event_is_announced_when_due(auth_client, fan):
    publish_at = timezone.now() + timedelta(hours=1)
    event_id = auth_client.post(
        "/api/events/", {**EVENT, "published_at": publish_at.isoformat()}, format="json"
    ).json()["id"]
    assert publish_due() == 0

    Event.objects.filter(pk=event_id).update(published_at=timezone.now() - timedelta(minutes=1))

    assert publish_due() == 1
    assert publish_due() == 0
    assert Notification.objects.filter(recipient=fan, kind="new_event").count() == 1


def test_unlisted_events_are_only_reachable_by_link(auth_client, api_client, fan):
    event_id = auth_client.post(
        "/api/events/", {**EVENT, "visibility": "unlisted"}, format="json"
    ).json()["id"]

    api_client.force_authenticate(fan)
    assert upcoming_titles(api_client) == []
    assert api_client.get(f"/api/events/{event_id}/").status_code == 200
    assert not Post.objects.exists() and not Notification.objects.exists()


def test_followers_only_events(auth_client, api_client, fan, make_user):
    event_id = auth_client.post(
        "/api/events/", {**EVENT, "visibility": "followers"}, format="json"
    ).json()["id"]

    api_client.force_authenticate(fan)
    assert upcoming_titles(api_client) == ["Board game night"]
    api_client.force_authenticate(make_user())
    assert upcoming_titles(api_client) == []
    assert api_client.get(f"/api/events/{event_id}/").status_code == 404


def test_cancel_and_postpone_notify_attendees(auth_client, api_client, fan):
    event_id = auth_client.post("/api/events/", EVENT, format="json").json()["id"]
    api_client.force_authenticate(fan)
    api_client.put(f"/api/events/{event_id}/attendance/", {"status": "going"}, format="json")

    auth_client.patch(f"/api/events/{event_id}/", {"status": "postponed"}, format="json")
    auth_client.patch(f"/api/events/{event_id}/", {"status": "cancelled"}, format="json")

    kinds = list(
        Notification.objects.filter(recipient=fan).order_by("pk").values_list("kind", flat=True)
    )
    assert kinds == ["new_event", "event_postponed", "event_cancelled"]
    assert upcoming_titles(api_client) == []
    response = api_client.put(
        f"/api/events/{event_id}/attendance/", {"status": "interested"}, format="json"
    )
    assert response.status_code == 400


def test_recurring_event_creates_a_series_announced_once(auth_client, fan):
    response = auth_client.post(
        "/api/events/",
        {**EVENT, "repeat": {"frequency": "weekly", "count": 3}, "categories": ["games"]},
        format="json",
    )
    assert response.status_code == 201, response.json()

    series = Event.objects.order_by("starts_at")
    assert [e.starts_at.day for e in series] == [10, 17, 24]
    assert len({e.series_id for e in series}) == 1
    assert all(e.categories.filter(slug="games").exists() for e in series)
    assert Notification.objects.filter(recipient=fan).count() == 1
    assert Post.objects.count() == 1


def test_monthly_series_keeps_the_day_or_the_months_last(auth_client):
    auth_client.post(
        "/api/events/",
        {
            **EVENT,
            "starts_at": "2030-01-31T18:00:00Z",
            "ends_at": "2030-01-31T20:00:00Z",
            "repeat": {"frequency": "monthly", "count": 3},
        },
        format="json",
    )
    assert [(e.starts_at.month, e.starts_at.day) for e in Event.objects.order_by("starts_at")] == [
        (1, 31),
        (2, 28),
        (3, 31),
    ]


def test_co_hosting_needs_acceptance_for_the_whole_series(
    auth_client, api_client, user, make_user, make_organization
):
    club_admin = make_user()
    club = make_organization("club", members=[club_admin])
    club.memberships.update(role="admin")

    auth_client.post(
        "/api/events/",
        {**EVENT, "co_host_handles": ["club"], "repeat": {"frequency": "weekly", "count": 2}},
        format="json",
    )
    first = Event.objects.order_by("starts_at").first()
    assert Notification.objects.get(recipient=club_admin).kind == "co_host_invite"
    assert auth_client.get(f"/api/events/{first.pk}/").json()["co_hosts"] == []

    api_client.force_authenticate(club_admin)
    assert [p["handle"] for p in api_client.get(f"/api/events/{first.pk}/co-host/").json()] == [
        "club"
    ]
    assert api_client.post(f"/api/events/{first.pk}/co-host/club/").status_code == 204

    assert not CoHost.objects.filter(accepted_at__isnull=True).exists()
    detail = auth_client.get(f"/api/events/{first.pk}/").json()
    assert [p["handle"] for p in detail["co_hosts"]] == ["club"]
    club_events = api_client.get("/api/profiles/club/events/").json()["results"]
    assert len(club_events) == 2


def test_reminders_go_once_to_going_and_interested(auth_client, user, make_user, make_event):
    from events.models import Attendance
    from events.services import remind_due

    host = make_user().profile
    soon = make_event(host, title="soon", starts_in=timedelta(hours=1))
    make_event(host, title="tomorrow", starts_in=timedelta(days=1))
    going, interested, waitlisted = (make_user() for _ in range(3))
    for person, status in (
        (going, "going"),
        (interested, "interested"),
        (waitlisted, "waitlisted"),
    ):
        Attendance.objects.create(event=soon, profile=person.profile, status=status)

    assert remind_due() == 1
    assert remind_due() == 0
    reminded = set(
        Notification.objects.filter(kind="event_reminder").values_list("recipient", flat=True)
    )
    assert reminded == {going.pk, interested.pk}

    soon.organizer = user.profile
    soon.save()
    later = (timezone.now() + timedelta(minutes=90)).isoformat()
    auth_client.patch(f"/api/events/{soon.pk}/", {"starts_at": later}, format="json")
    assert remind_due() == 1
