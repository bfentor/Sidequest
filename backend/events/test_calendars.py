from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from events import calendars
from events.models import Attendance, CalendarSource, Event
from notifications.models import Notification
from posts.models import Post


def ics(*events):
    return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + "".join(events) + "END:VCALENDAR\r\n"


def vevent(uid, start, hours=2, summary="Sauna night", extra=""):
    fmt = "%Y%m%dT%H%M%SZ"
    end = start + timedelta(hours=hours)
    return (
        f"BEGIN:VEVENT\r\nUID:{uid}\r\nDTSTART:{start:{fmt}}\r\nDTEND:{end:{fmt}}\r\n"
        f"SUMMARY:{summary}\r\nLOCATION:Guild hall\r\n{extra}END:VEVENT\r\n"
    )


@pytest.fixture
def feed(monkeypatch):
    """The calendar the fake server returns; tests change its `text`."""

    class Feed:
        text = ics()

    monkeypatch.setattr(
        calendars, "fetch_text", lambda url, **kwargs: (url, Feed.text) if Feed.text else None
    )
    return Feed


def soon(days):
    return (timezone.now() + timedelta(days=days)).replace(microsecond=0, second=0)


def test_adding_a_calendar_imports_its_events_quietly(auth_client, user, feed):
    feed.text = ics(
        vevent("a@guild", soon(2)),
        vevent("weekly@guild", soon(3), summary="Club", extra="RRULE:FREQ=WEEKLY;COUNT=3\r\n"),
        vevent("old@guild", soon(-3)),
    )
    url = f"/api/profiles/{user.profile.handle}/calendars/"
    response = auth_client.post(url, {"url": "webcal://cal.example/guild.ics"}, format="json")

    assert response.status_code == 201, response.json()
    assert response.json()["event_count"] == 4 and response.json()["error"] == ""
    sauna = Event.objects.get(source_uid="a@guild")
    assert sauna.organizer == user.profile and sauna.address == "Guild hall"
    assert Event.objects.filter(title="Club").count() == 3
    # Nothing flooded followers' feeds.
    assert not Post.objects.exists()


def test_later_syncs_add_update_and_remove(user, make_user, feed):
    start = soon(2)
    feed.text = ics(vevent("a@guild", start), vevent("b@guild", soon(4), summary="Quiz"))
    source = CalendarSource.objects.create(profile=user.profile, url="https://cal.example/x.ics")
    calendars.sync(source)
    sauna, quiz = Event.objects.get(source_uid="a@guild"), Event.objects.get(source_uid="b@guild")
    fan = make_user()
    Attendance.objects.create(event=sauna, profile=fan.profile, status="going")
    Attendance.objects.create(event=quiz, profile=fan.profile, status="going")

    # The sauna moved an hour, the quiz left the calendar, and a new event appeared.
    feed.text = ics(vevent("a@guild", start + timedelta(hours=1)), vevent("c@guild", soon(5)))
    assert calendars.sync(source) == (1, 1, 1)

    sauna.refresh_from_db()
    quiz.refresh_from_db()
    assert sauna.starts_at == start + timedelta(hours=1)
    assert quiz.status == Event.Status.CANCELLED
    kinds = set(Notification.objects.filter(recipient=fan).values_list("kind", flat=True))
    assert kinds == {"event_changed", "event_cancelled"}
    # New events after the first sync are announced like any other.
    assert Post.objects.filter(event__source_uid="c@guild").exists()


def test_broken_calendars_keep_an_error(auth_client, user, feed):
    feed.text = None
    url = f"/api/profiles/{user.profile.handle}/calendars/"
    response = auth_client.post(url, {"url": "https://cal.example/missing.ics"}, format="json")
    assert response.json()["error"] == "fetch"

    feed.text = "not a calendar"
    source = CalendarSource.objects.get()
    with pytest.raises(calendars.SyncError):
        calendars.sync(source)
    source.refresh_from_db()
    assert source.error == "parse"

    assert auth_client.post(url, {"url": "ftp://cal.example/x"}, format="json").status_code == 400


def test_only_hosts_manage_calendars(user, make_user, feed):
    stranger = APIClient()
    stranger.force_authenticate(make_user())
    url = f"/api/profiles/{user.profile.handle}/calendars/"
    assert stranger.get(url).status_code == 404
    assert (
        stranger.post(url, {"url": "https://cal.example/x.ics"}, format="json").status_code == 404
    )
