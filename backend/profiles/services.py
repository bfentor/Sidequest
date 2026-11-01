import re
import secrets

from .models import Profile


def generate_handle(email):
    """Derive an unused handle from the local part of an email address."""
    base = re.sub(r"[^a-z0-9_]", "_", email.split("@")[0].lower()).strip("_")[:24] or "user"
    handle = base
    while Profile.objects.filter(handle=handle).exists():
        handle = f"{base}_{secrets.randbelow(10_000):04d}"
    return handle


def create_person_profile(user):
    return Profile.objects.create(
        kind=Profile.Kind.PERSON,
        user=user,
        handle=generate_handle(user.email),
        display_name=user.email.split("@")[0],
    )
