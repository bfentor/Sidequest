from posts.models import Post

EVENT = {
    "title": "Board game night",
    "starts_at": "2030-01-10T18:00:00Z",
    "ends_at": "2030-01-10T22:00:00Z",
    "location": {"lat": 61.0650, "lng": 28.0940},
}


def test_publishing_an_event_announces_it(auth_client, user):
    response = auth_client.post("/api/events/", EVENT, format="json")

    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["organizer"]["handle"] == user.profile.handle
    assert body["location"] == EVENT["location"]
    assert Post.objects.get().event_id == body["id"]


def test_publish_as_organization_requires_membership(
    auth_client, user, make_user, make_organization
):
    make_organization("student_union", members=[user])
    make_organization("other_club", members=[make_user()])

    def publish_as(handle):
        return auth_client.post(
            "/api/events/", {**EVENT, "organizer_handle": handle}, format="json"
        )

    ok = publish_as("student_union")
    denied = publish_as("other_club")

    assert ok.status_code == 201
    assert ok.json()["organizer"]["handle"] == "student_union"
    assert denied.status_code == 400


def test_event_must_end_after_it_starts(auth_client):
    response = auth_client.post(
        "/api/events/", {**EVENT, "ends_at": EVENT["starts_at"]}, format="json"
    )
    assert response.status_code == 400
    assert "ends_at" in response.json()


def test_only_organizer_can_edit(api_client, make_user, make_event):
    event = make_event(make_user().profile)
    api_client.force_authenticate(make_user())

    assert api_client.patch(f"/api/events/{event.id}/", {"title": "Mine now"}).status_code == 403
