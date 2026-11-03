from datetime import timedelta

from rest_framework.test import APIClient

from events.models import Attendance
from profiles.models import Follow


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_views_are_counted_except_the_hosts_own(auth_client, api_client, user, make_event):
    event = make_event(user.profile)
    for _ in range(3):
        assert api_client.post(f"/api/events/{event.pk}/view/").status_code == 204
    auth_client.post(f"/api/events/{event.pk}/view/")

    stats = auth_client.get(f"/api/profiles/{user.profile.handle}/stats/").json()
    assert stats["views"][-1] == 3
    assert stats["events"][0]["views"] == 3


def test_dashboard_counts_rsvps_and_followers(auth_client, user, make_user, make_event):
    event = make_event(user.profile, starts_in=timedelta(days=2))
    make_event(user.profile, title="Long ago", starts_in=timedelta(days=-60))
    fans = [make_user() for _ in range(3)]
    Attendance.objects.create(event=event, profile=fans[0].profile, status="going")
    Attendance.objects.create(event=event, profile=fans[1].profile, status="interested")
    for fan in fans:
        Follow.objects.create(follower=fan.profile, followee=user.profile)

    stats = auth_client.get(f"/api/profiles/{user.profile.handle}/stats/").json()
    assert len(stats["days"]) == 30
    assert sum(stats["rsvps"]) == 2 and stats["rsvps"][-1] == 2
    assert sum(stats["new_followers"]) == 3 and stats["followers"] == 3
    assert [e["title"] for e in stats["events"]] == ["Event"]
    assert stats["events"][0]["going"] == 1 and stats["events"][0]["interested"] == 1


def test_only_people_acting_for_the_profile_see_its_dashboard(user, make_user):
    stranger = client_for(make_user())
    assert stranger.get(f"/api/profiles/{user.profile.handle}/stats/").status_code == 404
