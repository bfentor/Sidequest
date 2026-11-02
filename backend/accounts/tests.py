from accounts.models import User
from events.models import Event
from posts.models import Post
from profiles.models import Membership, Profile


def test_export_contains_the_users_data(auth_client, user):
    Post.objects.create(author=user.profile, body="hello")
    response = auth_client.get("/api/me/export/")

    assert response.status_code == 200
    assert "attachment" in response["Content-Disposition"]
    data = response.json()
    assert data["account"]["email"] == user.email
    assert data["posts"][0]["body"] == "hello"


def test_delete_requires_the_password(auth_client, user):
    response = auth_client.post("/api/me/account/delete/", {"password": "nope"})
    assert response.status_code == 400
    assert User.objects.filter(pk=user.pk).exists()


def test_delete_removes_personal_data_and_hands_over_organizations(
    auth_client, user, make_user, make_organization, make_event
):
    friend = make_user()
    shared = make_organization("shared", members=[user, friend])
    Membership.objects.filter(organization=shared, user=user).update(role="admin")
    alone = make_organization("alone", members=[user])
    Membership.objects.filter(organization=alone, user=user).update(role="admin")
    make_event(user.profile, title="mine")
    Post.objects.create(author=user.profile, body="bye")

    response = auth_client.post("/api/me/account/delete/", {"password": "x"})

    assert response.status_code == 204
    assert not User.objects.filter(pk=user.pk).exists()
    assert not Profile.objects.filter(handle__in=["me", "alone"]).exists()
    assert not Post.objects.exists() and not Event.objects.filter(title="mine").exists()
    assert Membership.objects.get(organization=shared, user=friend).role == "admin"
