from datetime import timedelta
from itertools import count

import pytest
from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from events.models import Event
from profiles.models import Membership, Profile

_ids = count()


@pytest.fixture(autouse=True)
def clear_cache():
    """Rate limits are counted in the cache; start each test from zero."""
    cache.clear()


@pytest.fixture
def make_user(db):
    def make(email=None):
        email = email or f"user{next(_ids)}@example.com"
        return User.objects.create_user(email=email, password="x")

    return make


@pytest.fixture
def user(make_user):
    return make_user("me@example.com")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


@pytest.fixture
def make_organization(db):
    def make(handle, members=()):
        org = Profile.objects.create(
            kind=Profile.Kind.ORGANIZATION, handle=handle, display_name=handle.title()
        )
        for member in members:
            Membership.objects.create(organization=org, user=member)
        return org

    return make


@pytest.fixture
def make_event(db):
    def make(organizer, starts_in=timedelta(days=1), duration=timedelta(hours=2), at=None, **kw):
        starts_at = timezone.now() + starts_in
        return Event.objects.create(
            organizer=organizer,
            title=kw.pop("title", "Event"),
            starts_at=starts_at,
            ends_at=starts_at + duration,
            location=Point(*at, srid=4326) if at else None,
            **kw,
        )

    return make
