from events.models import Attendance
from moderation.models import Block, Mute
from profiles.models import Profile

from .models import Notification


def notify(recipients, kind, *, actor=None, event=None, post=None, message=""):
    """Add a notification to each recipient's inbox (users, or person profiles).

    Skips the actor themselves, and anyone who blocked, was blocked by, or muted the actor.
    """
    users = {r.user if isinstance(r, Profile) else r for r in recipients}
    users.discard(None)
    if actor is not None:
        users.discard(actor.user)
        excluded = set(
            Block.objects.filter(blocker=actor).values_list("blocked__user", flat=True)
        ) | set(Block.objects.filter(blocked=actor).values_list("blocker__user", flat=True))
        excluded |= set(Mute.objects.filter(muted=actor).values_list("muter__user", flat=True))
        users = {user for user in users if user.pk not in excluded}

    Notification.objects.bulk_create(
        Notification(
            recipient=user, kind=kind, actor=actor, event=event, post=post, message=message
        )
        for user in users
    )


def followers_of(profile):
    return Profile.objects.filter(follows__followee=profile, user__isnull=False).select_related(
        "user"
    )


def going_to(event):
    return Profile.objects.filter(
        attendances__event=event, attendances__status=Attendance.Status.GOING
    ).select_related("user")
