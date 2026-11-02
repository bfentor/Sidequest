from django.utils import timezone

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


SIGNUP = "/_allauth/app/v1/auth/signup"


def signup(client, **fields):
    data = {"email": "new@uni.example", "password": "a-long-passphrase", **fields}
    return client.post(SIGNUP, data, format="json")


def test_signup_needs_terms_and_a_minimum_age(api_client, db, settings):
    settings.MINIMUM_AGE = 16
    today = timezone.localdate()
    too_young = today.replace(year=today.year - 15).isoformat()

    no_terms = signup(api_client, birth_date="2000-01-01")
    assert no_terms.status_code == 400
    assert {e["param"] for e in no_terms.json()["errors"]} == {"accept_terms"}
    assert signup(api_client, birth_date=too_young, accept_terms=True).status_code == 400

    # 401 with a pending email verification: the account exists, waiting for the code.
    assert signup(api_client, birth_date="2000-01-01", accept_terms=True).status_code == 401
    user = User.objects.get(email="new@uni.example")
    assert user.terms_version == settings.TERMS_VERSION and user.age >= 26


def test_accept_updated_terms(auth_client, user, settings):
    settings.TERMS_VERSION = "2030-01-01"
    assert auth_client.get("/api/me/settings/").json()["current_terms_version"] == "2030-01-01"
    auth_client.post("/api/me/accept-terms/")
    user.refresh_from_db()
    assert user.terms_version == "2030-01-01"


def test_birth_date_can_only_be_added_once(auth_client):
    assert auth_client.patch("/api/me/settings/", {"birth_date": "2001-02-03"}).status_code == 200
    assert auth_client.patch("/api/me/settings/", {"birth_date": "1990-01-01"}).status_code == 400


def test_age_limited_events(auth_client, user, make_user, make_event):
    event = make_event(make_user().profile, min_age=18)
    url = f"/api/events/{event.pk}/attendance/"

    assert auth_client.put(url, {"status": "going"}, format="json").status_code == 400
    user.birth_date = timezone.localdate().replace(year=timezone.localdate().year - 17)
    user.save()
    assert auth_client.put(url, {"status": "going"}, format="json").status_code == 400
    user.birth_date = user.birth_date.replace(year=user.birth_date.year - 2)
    user.save()
    assert auth_client.put(url, {"status": "going"}, format="json").status_code == 200


def test_onboarding_is_done_once(auth_client):
    assert auth_client.get("/api/me/settings/").json()["onboarded"] is False
    response = auth_client.patch("/api/me/settings/", {"onboarded": True}, format="json")
    assert response.json()["onboarded"] is True
    assert auth_client.get("/api/me/settings/").json()["onboarded"] is True
