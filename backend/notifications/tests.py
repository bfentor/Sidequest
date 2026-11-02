import pytest

from moderation.services import block
from notifications import push
from notifications.models import Kind, Notification, PushDevice
from profiles.models import Follow

EVENT = {
    "title": "Board game night",
    "starts_at": "2030-01-10T18:00:00Z",
    "ends_at": "2030-01-10T22:00:00Z",
}


@pytest.fixture
def sent(monkeypatch):
    """Captures what would go to Expo; each message gets an OK ticket."""
    messages = []

    def fake_send(batch):
        messages.extend(batch)
        return [{"status": "ok"} for _ in batch]

    monkeypatch.setattr(push, "send_to_expo", fake_send)
    return messages


def kinds_for(user):
    return list(Notification.objects.filter(recipient=user).values_list("kind", flat=True))


def test_following_notifies_the_followee(auth_client, user, make_user):
    other = make_user()
    auth_client.post(f"/api/profiles/{other.profile.handle}/follow/")
    auth_client.post(f"/api/profiles/{other.profile.handle}/follow/")  # no duplicate

    assert kinds_for(other) == [Kind.NEW_FOLLOWER]
    assert Notification.objects.get().actor == user.profile


def test_new_events_notify_followers_but_not_blocked_ones(auth_client, user, make_user):
    fan, blocked = make_user(), make_user()
    Follow.objects.create(follower=fan.profile, followee=user.profile)
    Follow.objects.create(follower=blocked.profile, followee=user.profile)
    block(user.profile, blocked.profile)

    auth_client.post("/api/events/", EVENT, format="json")

    assert kinds_for(fan) == [Kind.NEW_EVENT]
    assert kinds_for(blocked) == []
    assert kinds_for(user) == []


def test_waitlist_promotion_notifies(api_client, make_user, make_event):
    event = make_event(make_user().profile, capacity=1)
    first, second = make_user(), make_user()
    for person in (first, second):
        api_client.force_authenticate(person)
        api_client.put(f"/api/events/{event.pk}/attendance/", {"status": "going"}, format="json")

    api_client.force_authenticate(first)
    api_client.delete(f"/api/events/{event.pk}/attendance/")

    assert kinds_for(second) == [Kind.WAITLIST_PROMOTED]


def test_inbox_and_read_state(auth_client, user, make_user):
    others = [make_user() for _ in range(2)]
    for other in others:
        Notification.objects.create(recipient=user, kind=Kind.NEW_FOLLOWER, actor=other.profile)

    inbox = auth_client.get("/api/notifications/").json()["results"]
    assert [n["actor"]["handle"] for n in inbox] == [o.profile.handle for o in reversed(others)]
    assert auth_client.get("/api/notifications/unread/").json() == {"unread": 2}

    response = auth_client.post(
        "/api/notifications/read/", {"ids": [inbox[0]["id"]]}, format="json"
    )
    assert response.json() == {"unread": 1}
    assert auth_client.post("/api/notifications/read/", {}, format="json").json() == {"unread": 0}


def test_push_in_recipients_language_and_settings(auth_client, user, make_user, sent):
    other = make_user()
    PushDevice.objects.create(user=user, token="ExponentPushToken[me]")
    auth_client.patch("/api/me/settings/", {"language": "fi"}, format="json")
    Notification.objects.create(recipient=user, kind=Kind.NEW_FOLLOWER, actor=other.profile)

    assert push.send_pending() == 1
    assert sent[0]["to"] == "ExponentPushToken[me]"
    assert sent[0]["body"] == f"{other.profile.display_name} alkoi seurata sinua."
    assert sent[0]["data"] == {"url": f"/profiles/{other.profile.handle}"}
    assert push.send_pending() == 0  # already pushed

    settings = auth_client.patch(
        "/api/me/settings/", {"push": {"new_follower": False}}, format="json"
    ).json()
    assert settings["push"]["new_follower"] is False and settings["push"]["new_event"] is True
    Notification.objects.create(recipient=user, kind=Kind.NEW_FOLLOWER, actor=other.profile)
    assert push.send_pending() == 0
    assert not Notification.objects.filter(pushed_at__isnull=True).exists()


def test_unregistered_devices_are_forgotten(user, make_user, monkeypatch):
    PushDevice.objects.create(user=user, token="ExponentPushToken[gone]")
    Notification.objects.create(recipient=user, kind=Kind.NEW_FOLLOWER, actor=make_user().profile)
    monkeypatch.setattr(
        push,
        "send_to_expo",
        lambda batch: [{"status": "error", "details": {"error": "DeviceNotRegistered"}}],
    )

    push.send_pending()

    assert not PushDevice.objects.exists()


def test_failed_send_is_retried(user, make_user, monkeypatch):
    PushDevice.objects.create(user=user, token="ExponentPushToken[me]")
    Notification.objects.create(recipient=user, kind=Kind.NEW_FOLLOWER, actor=make_user().profile)

    def offline(batch):
        raise OSError("network down")

    monkeypatch.setattr(push, "send_to_expo", offline)
    push.send_pending()

    assert Notification.objects.get().pushed_at is None


def test_register_push_device_moves_token_to_new_user(api_client, make_user):
    first, second = make_user(), make_user()
    for person in (first, second):
        api_client.force_authenticate(person)
        response = api_client.post("/api/push-devices/", {"token": "ExponentPushToken[x]"})
        assert response.status_code == 204
    assert PushDevice.objects.get().user == second


def test_unregister_push_device(auth_client, user):
    PushDevice.objects.create(user=user, token="ExponentPushToken[abc]")
    response = auth_client.delete("/api/push-devices/ExponentPushToken%5Babc%5D/")
    assert response.status_code == 204
    assert not PushDevice.objects.exists()
