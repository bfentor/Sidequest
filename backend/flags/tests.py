from rest_framework.test import APIClient

from .models import Flag


def flags_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client.get("/api/flags/").json()


def test_flags_by_audience(user, make_user, db):
    Flag.objects.create(name="everyone", everyone=True)
    Flag.objects.create(name="staff-only", staff=True)
    tested = Flag.objects.create(name="testers")
    tested.testers.add(user)
    Flag.objects.create(name="off")

    assert flags_for() == {"everyone": True}
    assert flags_for(user) == {"everyone": True, "testers": True}
    admin = make_user()
    admin.is_staff = True
    admin.save()
    assert flags_for(admin) == {"everyone": True, "staff-only": True}


def test_percentage_rollouts_are_stable_and_grow(make_user, db):
    flag = Flag.objects.create(name="new-feed", percent=30)
    people = [make_user() for _ in range(200)]
    first = {p.pk for p in people if flag.is_on_for(p)}
    assert 30 <= len(first) <= 90
    assert first == {p.pk for p in people if flag.is_on_for(p)}

    flag.percent = 60
    assert first <= {p.pk for p in people if flag.is_on_for(p)}
