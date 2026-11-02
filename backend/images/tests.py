import os
from datetime import timedelta
from io import BytesIO, StringIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from PIL import Image as PILImage

from images.models import Image


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def photo(size=(3000, 1500), gps=True, name="photo.jpg"):
    """A JPEG like a phone's, with an EXIF GPS position."""
    image = PILImage.new("RGB", size, "teal")
    exif = PILImage.Exif()
    if gps:
        exif[0x8825] = {1: "N", 2: (61.0, 3.0, 54.0), 3: "E", 4: (28.0, 5.0, 38.0)}
    buffer = BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def upload(client, file):
    return client.post("/api/images/", {"file": file}, format="multipart")


def test_upload_is_resized_reencoded_and_stripped(auth_client, user):
    response = upload(auth_client, photo())

    assert response.status_code == 201, response.json()
    body = response.json()
    assert (body["width"], body["height"]) == (2048, 1024)
    assert body["url"].startswith("http://testserver/media/images/")

    image = Image.objects.get(pk=body["id"])
    assert image.uploader == user
    with PILImage.open(image.file) as stored:
        assert stored.format == "WEBP"
        assert not stored.getexif()


def test_rejects_files_that_are_not_images(auth_client):
    file = SimpleUploadedFile("notes.jpg", b"not an image", content_type="image/jpeg")
    assert upload(auth_client, file).status_code == 400


def test_upload_requires_sign_in(api_client, db):
    assert upload(api_client, photo()).status_code in (401, 403)


def test_avatar_must_be_your_own_upload(auth_client, make_user, api_client):
    other = make_user()
    api_client.force_authenticate(other)
    theirs = upload(api_client, photo(gps=False)).json()["id"]
    mine = upload(auth_client, photo(gps=False)).json()["id"]

    assert auth_client.patch("/api/me/", {"avatar_id": theirs}).status_code == 400
    response = auth_client.patch("/api/me/", {"avatar_id": mine})
    assert response.status_code == 200
    assert response.json()["avatar"]["id"] == mine


def test_orphan_images_are_deleted_after_a_day(auth_client, user):
    attached = Image.objects.get(pk=upload(auth_client, photo(gps=False)).json()["id"])
    orphan = Image.objects.get(pk=upload(auth_client, photo(gps=False)).json()["id"])
    recent = Image.objects.get(pk=upload(auth_client, photo(gps=False)).json()["id"])
    user.profile.avatar = attached
    user.profile.save()
    Image.objects.filter(pk__in=[attached.pk, orphan.pk]).update(
        created_at=timezone.now() - timedelta(days=2)
    )
    orphan_file = orphan.file.path

    call_command("delete_orphan_images", stdout=StringIO())

    assert set(Image.objects.values_list("pk", flat=True)) == {attached.pk, recent.pk}
    assert not os.path.exists(orphan_file)
