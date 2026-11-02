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
        {
            "email": "new@uni.example",
            "password": "a-long-passphrase",
            "birth_date": "2004-05-06",
            "accept_terms": True,
        },
        format="json",
    )
    assert response.status_code == 200
    token = response.json()["meta"]["session_token"]

    response = api_client.get("/api/me/", headers={"X-Session-Token": token})
    assert response.status_code == 200
    assert response.json()["handle"] == "new"


def test_follow_and_unfollow(auth_client, user, make_organization):
    org = make_organization("chess_club")

    assert auth_client.post(f"/api/profiles/{org.handle}/follow/").json() == {"status": "following"}
    profile = auth_client.get(f"/api/profiles/{org.handle}/").json()
    assert profile["follower_count"] == 1
    assert profile["is_followed"] is True

    assert auth_client.delete(f"/api/profiles/{org.handle}/follow/").json() == {"status": "none"}
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


def test_profile_details_and_verified_is_read_only(auth_client, user):
    response = auth_client.patch(
        "/api/me/",
        {
            "pronouns": "they/them",
            "university": "LUT",
            "study_year": 2,
            "instagram": "me_x",
            "verified": True,
        },
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["pronouns"], body["university"], body["study_year"]) == ("they/them", "LUT", 2)
    assert body["verified"] is False

    assert auth_client.patch("/api/me/", {"instagram": "@nope"}).status_code == 400
    assert auth_client.patch("/api/me/", {"study_year": 0}).status_code == 400


def test_followers_and_following_lists(auth_client, user, make_user):
    fans = [make_user() for _ in range(2)]
    for fan in fans:
        Follow.objects.create(follower=fan.profile, followee=user.profile)
    idol = make_user()
    Follow.objects.create(follower=user.profile, followee=idol.profile)

    followers = auth_client.get(f"/api/profiles/{user.profile.handle}/followers/").json()
    following = auth_client.get(f"/api/profiles/{user.profile.handle}/following/").json()

    assert [p["handle"] for p in followers["results"]] == [f.profile.handle for f in reversed(fans)]
    assert [p["handle"] for p in following["results"]] == [idol.profile.handle]


def test_profile_events_upcoming_and_past(api_client, user, make_event):
    from datetime import timedelta

    make_event(user.profile, title="next", starts_in=timedelta(days=1))
    make_event(user.profile, title="last week", starts_in=-timedelta(days=7))

    def titles(when):
        url = f"/api/profiles/{user.profile.handle}/events/?when={when}"
        return [e["title"] for e in api_client.get(url).json()["results"]]

    assert titles("upcoming") == ["next"]
    assert titles("past") == ["last week"]


def test_profile_posts(api_client, user):
    from posts.models import Post

    Post.objects.create(author=user.profile, body="first")
    Post.objects.create(author=user.profile, body="second")
    posts = api_client.get(f"/api/profiles/{user.profile.handle}/posts/").json()["results"]
    assert [p["body"] for p in posts] == ["second", "first"]


def test_private_profile_needs_approval(api_client, make_user):
    from notifications.models import Notification
    from posts.models import Post

    owner, fan = make_user(), make_user()
    owner.profile.is_private = True
    owner.profile.save()
    Post.objects.create(author=owner.profile, body="secret")
    handle = owner.profile.handle

    api_client.force_authenticate(fan)
    assert api_client.post(f"/api/profiles/{handle}/follow/").json() == {"status": "requested"}
    assert api_client.get(f"/api/profiles/{handle}/").json()["is_requested"] is True
    assert api_client.get(f"/api/profiles/{handle}/posts/").json()["results"] == []
    assert api_client.get(f"/api/profiles/{handle}/followers/").status_code == 403
    assert Notification.objects.get(recipient=owner).kind == "follow_request"

    api_client.force_authenticate(owner)
    requests = api_client.get("/api/me/follow-requests/").json()["results"]
    assert [p["handle"] for p in requests] == [fan.profile.handle]
    assert api_client.post(f"/api/me/follow-requests/{fan.profile.handle}/").status_code == 204

    api_client.force_authenticate(fan)
    assert [
        p["body"] for p in api_client.get(f"/api/profiles/{handle}/posts/").json()["results"]
    ] == ["secret"]
    assert Notification.objects.filter(recipient=fan, kind="follow_accepted").exists()


def test_declining_and_going_public(api_client, make_user):
    owner, first, second = make_user(), make_user(), make_user()
    owner.profile.is_private = True
    owner.profile.save()
    for fan in (first, second):
        api_client.force_authenticate(fan)
        api_client.post(f"/api/profiles/{owner.profile.handle}/follow/")

    api_client.force_authenticate(owner)
    api_client.delete(f"/api/me/follow-requests/{first.profile.handle}/")
    api_client.patch("/api/me/", {"is_private": False}, format="json")

    followers = set(owner.profile.followed_by.values_list("follower__handle", flat=True))
    assert followers == {second.profile.handle}


def test_hidden_followers(api_client, user, make_user):
    user.profile.hide_followers = True
    user.profile.save()
    api_client.force_authenticate(make_user())
    assert api_client.get(f"/api/profiles/{user.profile.handle}/followers/").status_code == 403
    api_client.force_authenticate(user)
    assert api_client.get(f"/api/profiles/{user.profile.handle}/followers/").status_code == 200
