from datetime import timedelta

from allauth.account.models import EmailAddress
from django.core import mail
from rest_framework.test import APIClient

from events.models import Attendance
from notifications.digest import send_due, unsubscribe_token
from profiles.models import Follow


def subscribed(user):
    user.email_digest = True
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return user


def test_digest_lists_the_week_once(user, make_user, make_event):
    subscribed(user)
    host = make_user().profile
    Follow.objects.create(follower=user.profile, followee=host)
    going = make_event(make_user().profile, title="Pub quiz", starts_in=timedelta(days=2))
    Attendance.objects.create(event=going, profile=user.profile, status="going")
    make_event(host, title="Sauna night", starts_in=timedelta(days=3))
    make_event(host, title="Next month", starts_in=timedelta(days=30))

    assert send_due("https://api.example") == 1
    [email] = mail.outbox
    assert "Pub quiz" in email.body and "Sauna night" in email.body
    assert "Next month" not in email.body
    raw = email.message().as_string()
    assert "List-Unsubscribe-Post: List-Unsubscribe=One-Click" in raw
    assert "List-Unsubscribe: <https://api.example/api/digest/unsubscribe/" in raw

    # Not again within the week.
    assert send_due("https://api.example") == 0


def test_digest_needs_opt_in_and_something_to_say(user, make_user, make_event):
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    event = make_event(make_user().profile, starts_in=timedelta(days=1))
    Attendance.objects.create(event=event, profile=user.profile, status="going")
    assert send_due("https://api.example") == 0

    # Opted in, but nothing coming up.
    subscribed(make_user())
    assert send_due("https://api.example") == 0
    assert not mail.outbox


def test_one_click_unsubscribe(user):
    subscribed(user)
    client = APIClient()
    assert client.post("/api/digest/unsubscribe/forged/").status_code == 404
    response = client.post(f"/api/digest/unsubscribe/{unsubscribe_token(user)}/")
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.email_digest is False


def test_turn_digest_on_in_settings(auth_client):
    assert auth_client.get("/api/me/settings/").json()["email_digest"] is False
    response = auth_client.patch("/api/me/settings/", {"email_digest": True}, format="json")
    assert response.json()["email_digest"] is True
