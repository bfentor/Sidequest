import pytest

from images.models import Image
from images.tests import photo, upload

from .models import Post


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
