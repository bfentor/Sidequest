"""Who may see whose content. Every list and detail endpoint filters through here."""

from django.db.models import Q

from profiles.models import Profile

from .models import Block, Mute


def viewer_profile(request):
    user = request.user
    return user.profile if user.is_authenticated else None


def hidden_profiles(viewer: Profile | None):
    """Profiles the viewer has blocked or been blocked by."""
    if viewer is None:
        return Profile.objects.none()
    return Profile.objects.filter(
        Q(pk__in=Block.objects.filter(blocker=viewer).values("blocked"))
        | Q(pk__in=Block.objects.filter(blocked=viewer).values("blocker"))
    ).values("pk")


def muted_profiles(viewer: Profile | None):
    if viewer is None:
        return Profile.objects.none()
    return Mute.objects.filter(muter=viewer).values("muted")


def is_blocked_by(viewer: Profile | None, profile: Profile):
    """Whether `profile` has blocked the viewer (so the viewer may not see it)."""
    return viewer is not None and Block.objects.filter(blocker=profile, blocked=viewer).exists()
