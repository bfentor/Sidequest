from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from profiles.models import Follow

from .models import Block, ModerationAction, Report


def block(blocker, blocked):
    """Block a profile; follows between the two end, both ways."""
    with transaction.atomic():
        Block.objects.get_or_create(blocker=blocker, blocked=blocked)
        Follow.objects.filter(follower=blocker, followee=blocked).delete()
        Follow.objects.filter(follower=blocked, followee=blocker).delete()


def _reports_for(target):
    return Report.objects.filter(
        content_type=ContentType.objects.get_for_model(target),
        object_id=target.pk,
        status=Report.Status.OPEN,
    )


def _log(moderator, kind, target, note):
    ModerationAction.objects.create(
        moderator=moderator,
        kind=kind,
        content_type=ContentType.objects.get_for_model(target),
        object_id=target.pk,
        note=note,
    )


@transaction.atomic
def remove(target, moderator, note=""):
    """Hide a post, event or profile everywhere and resolve its open reports."""
    now = timezone.now()
    target.removed_at = now
    target.save(update_fields=["removed_at"])
    _reports_for(target).update(status=Report.Status.RESOLVED, resolved_at=now)
    _log(moderator, ModerationAction.Kind.REMOVE, target, note)


@transaction.atomic
def restore(target, moderator, note=""):
    target.removed_at = None
    target.save(update_fields=["removed_at"])
    _log(moderator, ModerationAction.Kind.RESTORE, target, note)


@transaction.atomic
def dismiss(target, moderator, note=""):
    """Close the open reports about a target without acting on it."""
    _reports_for(target).update(status=Report.Status.DISMISSED, resolved_at=timezone.now())
    _log(moderator, ModerationAction.Kind.DISMISS, target, note)
