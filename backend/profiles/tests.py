from profiles.models import Follow, Profile


def test_every_new_user_gets_a_unique_person_profile(make_user):
    first = make_user("alex@uni.example")
    second = make_user("alex@other.example")

    assert first.profile.kind == Profile.Kind.PERSON
    assert first.profile.handle == "alex"
    assert second.profile.handle.startswith("alex_")


def test_sign_up_and_use_session_token(api_client, db):
    response = api_client.post(
        "/_allauth/app/v1/auth/signup",
        {"email": "new@uni.example", "password": "a-long-passphrase"},
        format="json",
    )
    assert response.status_code == 200
    token = response.json()["meta"]["session_token"]

    response = api_client.get("/api/me/", headers={"X-Session-Token": token})
    assert response.status_code == 200
    assert response.json()["handle"] == "new"


def test_follow_and_unfollow(auth_client, user, make_organization):
    org = make_organization("chess_club")

    assert auth_client.post(f"/api/profiles/{org.handle}/follow/").status_code == 204
    profile = auth_client.get(f"/api/profiles/{org.handle}/").json()
    assert profile["follower_count"] == 1
    assert profile["is_followed"] is True

    assert auth_client.delete(f"/api/profiles/{org.handle}/follow/").status_code == 204
    assert not Follow.objects.exists()


def test_cannot_follow_self(auth_client, user):
    response = auth_client.post(f"/api/profiles/{user.profile.handle}/follow/")
    assert response.status_code == 400


def test_update_own_profile(auth_client):
    response = auth_client.patch("/api/me/", {"display_name": "Me", "handle": "me_2"})
    assert response.status_code == 200
    assert response.json()["handle"] == "me_2"

    response = auth_client.patch("/api/me/", {"handle": "Not Valid"})
    assert response.status_code == 400


def test_errors_follow_the_requested_language(auth_client, user):
    response = auth_client.post(
        f"/api/profiles/{user.profile.handle}/follow/", headers={"Accept-Language": "fi"}
    )
    assert response.json() == ["Et voi seurata itseäsi."]
