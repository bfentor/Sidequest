from rest_framework.test import APIClient

from moderation.models import FilteredTerm, Report


def test_blocked_terms_stop_the_text(auth_client, make_user, make_event):
    FilteredTerm.objects.create(term="Badword", action="block")

    post = auth_client.post("/api/posts/", {"body": "what a BADWORD thing"}, format="json")
    assert post.status_code == 400 and "body" in post.json()
    # Whole words only.
    assert auth_client.post("/api/posts/", {"body": "badwording"}, format="json").status_code == 201

    event = make_event(make_user().profile)
    comment = auth_client.post(
        f"/api/events/{event.pk}/comments/", {"body": "badword!"}, format="json"
    )
    assert comment.status_code == 400

    new_event = {
        "title": "Badword party",
        "starts_at": "2030-01-10T18:00:00Z",
        "ends_at": "2030-01-10T22:00:00Z",
    }
    response = auth_client.post("/api/events/", new_event, format="json")
    assert response.status_code == 400 and "title" in response.json()


def test_flagged_terms_go_to_the_moderation_queue_once(auth_client):
    FilteredTerm.objects.create(term="sketchy", action="flag")
    post = auth_client.post("/api/posts/", {"body": "A sketchy offer"}, format="json").json()
    auth_client.patch(f"/api/posts/{post['id']}/", {"body": "Still sketchy"}, format="json")

    report = Report.objects.get()
    assert report.reporter is None and report.object_id == post["id"]
    assert "sketchy" in report.details


def test_spam_link_floods_and_repeats(auth_client, make_user):
    links = " ".join(f"https://spam.example/{n}" for n in range(6))
    assert auth_client.post("/api/posts/", {"body": links}, format="json").status_code == 400

    body = {"body": "Selling cheap tickets, message me now"}
    assert auth_client.post("/api/posts/", body, format="json").status_code == 201
    assert auth_client.post("/api/posts/", body, format="json").status_code == 400
    # Someone else saying the same thing is fine.
    other = APIClient()
    other.force_authenticate(make_user())
    assert other.post("/api/posts/", body, format="json").status_code == 201
