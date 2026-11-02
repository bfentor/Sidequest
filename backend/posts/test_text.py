from rest_framework.test import APIClient

from moderation.models import Block
from notifications.models import Notification
from profiles.models import Follow

from .text import mentioned_handles


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def mentions_of(user):
    return Notification.objects.filter(recipient=user, kind="mention")


def test_mentioned_handles():
    text = "Thanks @Alice and @bob_2! Mail me at me@uni.fi, cc @alice"
    assert mentioned_handles(text) == ["alice", "bob_2"]


def test_mentioning_an_organization_tells_its_admins(auth_client, make_user, make_organization):
    admin = make_user()
    club = make_organization("club", members=[admin])
    club.memberships.update(role="admin")
    auth_client.post("/api/posts/", {"body": f"Thanks @{club.handle}!"}, format="json")
    assert mentions_of(admin).count() == 1


def test_mentions_notify_once_and_only_new_ones(auth_client, make_user):
    alice, bob = make_user(), make_user()
    a, b = alice.profile.handle, bob.profile.handle

    post = auth_client.post("/api/posts/", {"body": f"Hi @{a}"}, format="json").json()
    assert mentions_of(alice).count() == 1

    auth_client.patch(f"/api/posts/{post['id']}/", {"body": f"Hi @{a} and @{b}"}, format="json")
    assert mentions_of(alice).count() == 1
    assert mentions_of(bob).get().post_id == post["id"]

    auth_client.post(f"/api/posts/{post['id']}/comments/", {"body": f"@{a} see"}, format="json")
    assert mentions_of(alice).count() == 2


def test_mentions_skip_people_who_cant_see_it_or_blocked_you(user, make_user):
    private = make_user()
    private.profile.is_private = True
    private.profile.save()
    reader, blocker = make_user(), make_user()
    Block.objects.create(blocker=blocker.profile, blocked=private.profile)
    Follow.objects.create(follower=reader.profile, followee=private.profile)

    handles = " ".join(f"@{u.profile.handle}" for u in (user, reader, blocker))
    client_for(private).post("/api/posts/", {"body": handles}, format="json")

    # `user` doesn't follow the private account, so can't see the post.
    assert not mentions_of(user).exists()
    assert mentions_of(reader).exists()
    assert not mentions_of(blocker).exists()


def test_hashtag_feed(auth_client, api_client):
    for body in ("Sauna night #Sauna", "#saunanight is different", "No tag", "#sauna, again"):
        auth_client.post("/api/posts/", {"body": body}, format="json")

    results = api_client.get("/api/feeds/hashtag/sauna/").json()["results"]
    assert [post["body"] for post in results] == ["#sauna, again", "Sauna night #Sauna"]
    assert api_client.get("/api/feeds/hashtag/SAUNA/").json()["results"][0]["body"] == (
        "#sauna, again"
    )
