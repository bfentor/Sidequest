from datetime import timedelta

import pytest
from django.contrib.admin.sites import site
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory

from moderation import services
from moderation.admin import ReportAdmin
from moderation.models import Block, ModerationAction, Report
from posts.models import Post
from profiles.models import Follow


def upcoming_titles(client):
    return [e["title"] for e in client.get("/api/feeds/upcoming/").json()["results"]]


@pytest.fixture
def other(make_user):
    return make_user("other@example.com")


def test_report_a_post(auth_client, other):
    post = Post.objects.create(author=other.profile, body="spam spam")

    response = auth_client.post(
        "/api/reports/",
        {"target_type": "post", "target_id": str(post.pk), "reason": "spam"},
        format="json",
    )

    assert response.status_code == 201, response.json()
    report = Report.objects.get()
    assert report.target == post
    assert report.status == Report.Status.OPEN


def test_report_a_profile_by_handle(auth_client, other):
    response = auth_client.post(
        "/api/reports/",
        {"target_type": "profile", "target_id": other.profile.handle, "reason": "harassment"},
        format="json",
    )
    assert response.status_code == 201
    assert Report.objects.get().target == other.profile


def test_cannot_report_missing_content(auth_client):
    response = auth_client.post(
        "/api/reports/", {"target_type": "event", "target_id": "999", "reason": "spam"}
    )
    assert response.status_code == 400


def test_block_hides_both_ways_and_ends_follows(auth_client, user, other, make_event, api_client):
    make_event(other.profile, title="theirs")
    make_event(user.profile, title="mine")
    Follow.objects.create(follower=user.profile, followee=other.profile)
    Follow.objects.create(follower=other.profile, followee=user.profile)

    assert auth_client.post(f"/api/profiles/{other.profile.handle}/block/").status_code == 204

    assert not Follow.objects.exists()
    assert upcoming_titles(auth_client) == ["mine"]
    api_client.force_authenticate(other)
    assert upcoming_titles(api_client) == ["theirs"]
    # The blocked profile can't see the blocker's profile; the blocker still can (to unblock).
    assert api_client.get(f"/api/profiles/{user.profile.handle}/").status_code == 404
    profile = auth_client.get(f"/api/profiles/{other.profile.handle}/").json()
    assert profile["is_blocked"] is True
    # Neither side can follow the other while blocked.
    assert auth_client.post(f"/api/profiles/{other.profile.handle}/follow/").status_code == 400
    assert api_client.post(f"/api/profiles/{user.profile.handle}/follow/").status_code == 404

    assert auth_client.delete(f"/api/profiles/{other.profile.handle}/block/").status_code == 204
    assert sorted(upcoming_titles(auth_client)) == ["mine", "theirs"]


def test_mute_hides_from_feeds_only(auth_client, user, other, make_event):
    make_event(other.profile, title="theirs")
    Follow.objects.create(follower=user.profile, followee=other.profile)
    post = Post.objects.create(author=other.profile, body="hello")

    auth_client.post(f"/api/profiles/{other.profile.handle}/mute/")

    assert upcoming_titles(auth_client) == []
    assert auth_client.get("/api/feeds/following/").json()["results"] == []
    # Still reachable directly, and still followed.
    assert auth_client.get(f"/api/posts/{post.pk}/").status_code == 200
    assert auth_client.get(f"/api/profiles/{other.profile.handle}/").json()["is_muted"] is True
    assert [p["handle"] for p in auth_client.get("/api/me/muted/").json()] == [other.profile.handle]


def test_removed_content_disappears(auth_client, admin_user, other, make_event):
    event = make_event(other.profile, title="removed")
    post = Post.objects.create(author=other.profile, event=event)
    report = Report.objects.create(reporter=admin_user, target=event, reason="spam")

    services.remove(event, admin_user, note="spam")

    assert upcoming_titles(auth_client) == []
    assert auth_client.get(f"/api/events/{event.pk}/").status_code == 404
    # A post sharing a removed event is hidden too.
    assert auth_client.get(f"/api/posts/{post.pk}/").status_code == 404
    report.refresh_from_db()
    assert report.status == Report.Status.RESOLVED
    assert ModerationAction.objects.get().kind == ModerationAction.Kind.REMOVE


def test_admin_queue_actions(admin_user, other, make_event):
    keep = make_event(other.profile, title="fine")
    drop = make_event(other.profile, title="bad", starts_in=timedelta(days=2))
    Report.objects.create(reporter=admin_user, target=keep, reason="other")
    Report.objects.create(reporter=admin_user, target=drop, reason="spam")
    request = RequestFactory().post("/")
    request.user = admin_user
    request.session = {}
    request._messages = FallbackStorage(request)
    model_admin = ReportAdmin(Report, site)

    model_admin.dismiss_reports(request, Report.objects.filter(object_id=keep.pk))
    model_admin.remove_reported_content(request, Report.objects.filter(object_id=drop.pk))

    keep.refresh_from_db()
    drop.refresh_from_db()
    assert keep.removed_at is None and drop.removed_at is not None
    assert set(Report.objects.values_list("status", flat=True)) == {"dismissed", "resolved"}
    assert ModerationAction.objects.count() == 2


def test_blocks_are_unique(user, other):
    services.block(user.profile, other.profile)
    services.block(user.profile, other.profile)
    assert Block.objects.count() == 1
