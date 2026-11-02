from events.models import Category
from moderation.models import Block, Mute
from profiles.models import Follow, FollowRequest


def handles(response):
    return [profile["handle"] for profile in response.json()]


def test_suggestions_rank_mutuals_then_interests_then_popularity(
    auth_client, user, make_user, make_organization
):
    me = user.profile
    games = Category.objects.get(slug="games")
    me.interests.add(games)
    friend = make_user().profile
    Follow.objects.create(follower=me, followee=friend)

    mutual = make_organization("mutual")
    Follow.objects.create(follower=friend, followee=mutual)
    gamers = make_organization("gamers")
    gamers.interests.add(games)
    popular = make_organization("popular")
    for _ in range(3):
        Follow.objects.create(follower=make_user().profile, followee=popular)
    make_organization("quiet")
    for handle in ("blocked", "muted", "requested"):
        make_organization(handle)
    Block.objects.create(blocker=me, blocked=make_organization("blocked2"))
    Mute.objects.create(muter=me, muted=make_organization("muted2"))
    FollowRequest.objects.create(requester=me, target=make_organization("requested2"))

    response = auth_client.get("/api/me/suggestions/", {"kind": "organization"})

    ranked = handles(response)
    assert ranked[:3] == ["mutual", "gamers", "popular"]
    assert not {"blocked2", "muted2", "requested2"} & set(ranked)
    assert response.json()[0]["is_followed"] is False


def test_suggestions_leave_out_followed_and_own_profiles(auth_client, user, make_user):
    followed = make_user().profile
    Follow.objects.create(follower=user.profile, followee=followed)
    other = make_user().profile

    assert handles(auth_client.get("/api/me/suggestions/")) == [other.handle]


def test_suggestions_require_sign_in(api_client, db):
    assert api_client.get("/api/me/suggestions/").status_code in (401, 403)
