from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from images.models import Image
from images.tests import photo, upload

from .models import Post


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def test_post_with_pictures_in_order(auth_client):
    first, second = (upload(auth_client, photo(gps=False)).json()["id"] for _ in range(2))

    response = auth_client.post("/api/posts/", {"image_ids": [second, first]}, format="json")

    assert response.status_code == 201, response.json()
    assert [image["id"] for image in response.json()["images"]] == [second, first]
    assert not Image.orphans().exists()


def test_a_post_needs_something(auth_client):
    response = auth_client.post("/api/posts/", {"body": "  "}, format="json")
    assert response.status_code == 400


def test_pictures_must_be_your_own_and_at_most_four(auth_client, api_client, make_user):
    api_client.force_authenticate(make_user())
    theirs = upload(api_client, photo(gps=False)).json()["id"]
    assert (
        auth_client.post("/api/posts/", {"image_ids": [theirs]}, format="json").status_code == 400
    )

    mine = [upload(auth_client, photo(gps=False)).json()["id"] for _ in range(5)]
    assert auth_client.post("/api/posts/", {"image_ids": mine}, format="json").status_code == 400


def test_edit_marks_the_post_edited(auth_client, api_client, user, make_user):
    post = Post.objects.create(author=user.profile, body="helo")
    picture = upload(auth_client, photo(gps=False)).json()["id"]

    response = auth_client.patch(
        f"/api/posts/{post.pk}/", {"body": "hello", "image_ids": [picture]}, format="json"
    )

    assert response.status_code == 200, response.json()
    assert response.json()["body"] == "hello"
    assert response.json()["edited_at"] is not None
    assert len(response.json()["images"]) == 1

    # Removing the text is fine while a picture is left; removing both isn't.
    assert (
        auth_client.patch(f"/api/posts/{post.pk}/", {"body": ""}, format="json").status_code == 200
    )
    response = auth_client.patch(f"/api/posts/{post.pk}/", {"image_ids": []}, format="json")
    assert response.status_code == 400

    api_client.force_authenticate(make_user())
    response = api_client.patch(f"/api/posts/{post.pk}/", {"body": "mine now"}, format="json")
    assert response.status_code == 403


def test_like_and_unlike(auth_client, api_client, user, make_user):
    from notifications.models import Notification

    author = make_user()
    post = Post.objects.create(author=author.profile, body="hi")

    assert auth_client.put(f"/api/posts/{post.pk}/like/").status_code == 204
    assert auth_client.put(f"/api/posts/{post.pk}/like/").status_code == 204
    data = auth_client.get(f"/api/posts/{post.pk}/").json()
    assert (data["like_count"], data["is_liked"]) == (1, True)
    assert Notification.objects.filter(recipient=author, kind="reaction").count() == 1

    anonymous = api_client.get(f"/api/posts/{post.pk}/").json()
    assert (anonymous["like_count"], anonymous["is_liked"]) == (1, False)

    assert auth_client.delete(f"/api/posts/{post.pk}/like/").status_code == 204
    assert auth_client.get(f"/api/posts/{post.pk}/").json()["like_count"] == 0


def test_comments_on_posts_and_events(auth_client, api_client, user, make_user, make_event):
    from moderation.models import Block
    from notifications.models import Notification

    author = make_user()
    post = Post.objects.create(author=author.profile, body="hi")
    event = make_event(author.profile, title="party")

    response = auth_client.post(
        f"/api/posts/{post.pk}/comments/", {"body": " nice "}, format="json"
    )
    assert response.status_code == 201, response.json()
    assert response.json()["body"] == "nice"
    assert response.json()["can_delete"] is True
    auth_client.post(f"/api/events/{event.pk}/comments/", {"body": "Is it free?"}, format="json")
    assert Notification.objects.filter(recipient=author, kind="comment").count() == 2
    assert (
        auth_client.post(
            f"/api/posts/{post.pk}/comments/", {"body": "  "}, format="json"
        ).status_code
        == 400
    )

    comments = api_client.get(f"/api/posts/{post.pk}/comments/").json()["results"]
    assert [(c["body"], c["can_delete"]) for c in comments] == [("nice", False)]
    assert api_client.get(f"/api/posts/{post.pk}/").json()["comment_count"] == 1
    questions = api_client.get(f"/api/events/{event.pk}/comments/").json()["results"]
    assert [c["body"] for c in questions] == ["Is it free?"]

    # Someone who blocked the commenter doesn't see their comments.
    api_client.force_authenticate(author)
    Block.objects.create(blocker=author.profile, blocked=user.profile)
    assert api_client.get(f"/api/posts/{post.pk}/comments/").json()["results"] == []
    Block.objects.all().delete()

    # The post's author may delete comments on it; strangers may not.
    comment_id = comments[0]["id"]
    stranger = client_for(make_user())
    assert stranger.delete(f"/api/comments/{comment_id}/").status_code == 403
    assert api_client.delete(f"/api/comments/{comment_id}/").status_code == 204
    assert auth_client.get(f"/api/posts/{post.pk}/").json()["comment_count"] == 0


def test_event_photos_come_from_posts_sharing_it(
    auth_client, api_client, user, make_user, make_event
):
    event = make_event(make_user().profile, starts_in=timedelta(hours=-3))
    first, second = (upload(auth_client, photo(gps=False)).json()["id"] for _ in range(2))
    auth_client.post("/api/posts/", {"event_id": event.pk, "image_ids": [first]}, format="json")
    later = auth_client.post(
        "/api/posts/", {"event_id": event.pk, "image_ids": [second]}, format="json"
    ).json()
    auth_client.post("/api/posts/", {"body": "Not about the event"}, format="json")

    photos = api_client.get(f"/api/events/{event.pk}/photos/").json()["results"]
    assert [p["image"]["id"] for p in photos] == [second, first]
    assert photos[0]["post_id"] == later["id"]
    assert photos[0]["author"]["handle"] == user.profile.handle

    # Removed posts take their pictures out of the gallery.
    Post.objects.filter(pk=later["id"]).update(removed_at=timezone.now())
    photos = api_client.get(f"/api/events/{event.pk}/photos/").json()["results"]
    assert [p["image"]["id"] for p in photos] == [first]
