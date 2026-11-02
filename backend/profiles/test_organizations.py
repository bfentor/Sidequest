import pytest

from notifications.models import Notification
from profiles.models import Invitation, Membership, Profile, VerificationRequest


@pytest.fixture
def org(auth_client):
    response = auth_client.post(
        "/api/organizations/", {"handle": "chess_club", "display_name": "Chess Club"}
    )
    assert response.status_code == 201, response.json()
    return Profile.objects.get(handle="chess_club")


def test_creator_becomes_admin_and_can_act_as_it(auth_client, user, org):
    assert Membership.objects.get(organization=org).role == "admin"
    acting = auth_client.get("/api/me/profiles/").json()
    assert [(p["handle"], p["role"]) for p in acting] == [
        (user.profile.handle, "self"),
        ("chess_club", "admin"),
    ]


def test_invite_accept_and_roles(auth_client, api_client, user, make_user, org):
    friend = make_user()

    response = auth_client.post(
        f"/api/organizations/{org.handle}/members/", {"handle": friend.profile.handle}
    )
    assert response.status_code == 201
    assert Notification.objects.get(recipient=friend).kind == "organization_invite"

    api_client.force_authenticate(friend)
    invitation = api_client.get("/api/me/invitations/").json()[0]
    assert invitation["organization"]["handle"] == "chess_club"
    assert api_client.post(f"/api/me/invitations/{invitation['id']}/").status_code == 204
    assert Membership.objects.get(organization=org, user=friend).role == "editor"

    # Editors can't invite or change roles.
    assert (
        api_client.post(f"/api/organizations/{org.handle}/members/", {"handle": "x"}).status_code
        == 403
    )
    url = f"/api/organizations/{org.handle}/members/{friend.profile.handle}/"
    assert auth_client.patch(url, {"role": "admin"}, format="json").status_code == 200

    members = auth_client.get(f"/api/organizations/{org.handle}/members/").json()
    assert {m["profile"]["handle"]: m["role"] for m in members} == {
        user.profile.handle: "admin",
        friend.profile.handle: "admin",
    }


def test_last_admin_cannot_leave(auth_client, user, org):
    url = f"/api/organizations/{org.handle}/members/{user.profile.handle}/"
    assert auth_client.delete(url).status_code == 400


def test_decline_invitation(auth_client, api_client, make_user, org):
    friend = make_user()
    auth_client.post(f"/api/organizations/{org.handle}/members/", {"handle": friend.profile.handle})
    invitation = Invitation.objects.get()

    api_client.force_authenticate(friend)
    assert api_client.delete(f"/api/me/invitations/{invitation.pk}/").status_code == 204
    assert not Membership.objects.filter(user=friend).exists()


def test_only_admins_edit_and_request_verification(auth_client, api_client, make_user, org):
    response = auth_client.patch(
        f"/api/organizations/{org.handle}/", {"bio": "Every Tuesday"}, format="json"
    )
    assert response.status_code == 200
    org.refresh_from_db()
    assert org.bio == "Every Tuesday"

    api_client.force_authenticate(make_user())
    assert api_client.patch(f"/api/organizations/{org.handle}/", {"bio": "x"}).status_code == 403

    response = auth_client.post(
        f"/api/organizations/{org.handle}/verification/", {"message": "Official LUT club"}
    )
    assert response.status_code == 201
    assert VerificationRequest.objects.get().status == "pending"


def test_publish_event_as_organization(auth_client, org):
    response = auth_client.post(
        "/api/events/",
        {
            "organizer_handle": org.handle,
            "title": "Tournament",
            "starts_at": "2030-01-10T18:00:00Z",
            "ends_at": "2030-01-10T22:00:00Z",
        },
        format="json",
    )
    assert response.json()["organizer"]["handle"] == org.handle
