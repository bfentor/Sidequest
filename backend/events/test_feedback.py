from datetime import timedelta

from rest_framework.test import APIClient

from events.models import Attendance
from events.services import request_feedback_due
from notifications.models import Notification


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_people_who_went_rate_an_event_after_it_ends(auth_client, user, make_user, make_event):
    event = make_event(make_user().profile, starts_in=timedelta(hours=-3))
    url = f"/api/events/{event.pk}/feedback/mine/"

    # Not going: can't rate.
    assert auth_client.get(url).json() == {"can_give": False, "rating": None, "comment": ""}
    assert auth_client.put(url, {"rating": 5}, format="json").status_code == 400

    Attendance.objects.create(event=event, profile=user.profile, status="going")
    assert auth_client.get(url).json()["can_give"] is True
    assert auth_client.put(url, {"rating": 6}, format="json").status_code == 400
    rated = auth_client.put(url, {"rating": 4, "comment": "Great"}, format="json").json()
    assert rated == {"can_give": True, "rating": 4, "comment": "Great"}
    # Changing it replaces the rating.
    assert auth_client.put(url, {"rating": 5}, format="json").json()["rating"] == 5
    assert event.feedback.count() == 1

    upcoming = make_event(make_user().profile)
    Attendance.objects.create(event=upcoming, profile=user.profile, status="going")
    assert auth_client.get(f"/api/events/{upcoming.pk}/feedback/mine/").json()["can_give"] is False


def test_hosts_see_feedback_without_names(auth_client, user, make_user, make_event):
    event = make_event(user.profile, starts_in=timedelta(hours=-3))
    for rating, comment in ((5, "Loved it"), (4, ""), (5, "")):
        guest = make_user()
        Attendance.objects.create(event=event, profile=guest.profile, status="going")
        client_for(guest).put(
            f"/api/events/{event.pk}/feedback/mine/",
            {"rating": rating, "comment": comment},
            format="json",
        )

    summary = auth_client.get(f"/api/events/{event.pk}/feedback/").json()
    assert summary["count"] == 3
    assert round(summary["average"], 2) == 4.67
    assert summary["ratings"] == [0, 0, 0, 1, 2]
    assert [c["comment"] for c in summary["comments"]] == ["Loved it"]
    assert "author" not in summary["comments"][0]

    assert client_for(make_user()).get(f"/api/events/{event.pk}/feedback/").status_code == 403


def test_feedback_is_requested_once_from_people_going(make_user, make_event):
    host = make_user().profile
    ended = make_event(host, starts_in=timedelta(hours=-3))
    make_event(host, title="long ago", starts_in=timedelta(days=-5))
    make_event(host, title="upcoming")
    going, interested = make_user(), make_user()
    Attendance.objects.create(event=ended, profile=going.profile, status="going")
    Attendance.objects.create(event=ended, profile=interested.profile, status="interested")

    assert request_feedback_due() == 1
    assert request_feedback_due() == 0
    asked = Notification.objects.filter(kind="feedback_request")
    assert list(asked.values_list("recipient", flat=True)) == [going.pk]
