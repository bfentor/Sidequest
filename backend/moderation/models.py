from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from profiles.models import Profile


class Block(models.Model):
    """Hides two profiles from each other, both ways, and ends their follows."""

    blocker = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="blocks")
    blocked = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="blocked_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="unique_block"),
            models.CheckConstraint(condition=~Q(blocker=models.F("blocked")), name="no_self_block"),
        ]

    def __str__(self):
        return f"{self.blocker} blocks {self.blocked}"


class Mute(models.Model):
    """Hides a profile's posts and events from the muter's feeds. The muted profile isn't told."""

    muter = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="mutes")
    muted = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="muted_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["muter", "muted"], name="unique_mute"),
            models.CheckConstraint(condition=~Q(muter=models.F("muted")), name="no_self_mute"),
        ]

    def __str__(self):
        return f"{self.muter} mutes {self.muted}"


class Report(models.Model):
    """Someone flagging a post, event or profile for moderators to review."""

    class Reason(models.TextChoices):
        SPAM = "spam", _("Spam")
        HARASSMENT = "harassment", _("Harassment or bullying")
        HATE = "hate", _("Hate speech")
        SEXUAL = "sexual", _("Nudity or sexual content")
        VIOLENCE = "violence", _("Violence or dangerous activity")
        FALSE_INFORMATION = "false_information", _("False information")
        OTHER = "other", _("Something else")

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        RESOLVED = "resolved", _("Resolved")
        DISMISSED = "dismissed", _("Dismissed")

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="reports"
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    reason = models.CharField(max_length=30, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["content_type", "object_id"]),
        ]

    def __str__(self):
        return f"Report of {self.content_type.model} {self.object_id} ({self.get_reason_display()})"


class ModerationAction(models.Model):
    """Audit log: who did what to which content, and why."""

    class Kind(models.TextChoices):
        REMOVE = "remove", _("Removed content")
        RESTORE = "restore", _("Restored content")
        DISMISS = "dismiss", _("Dismissed reports")

    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.content_type.model} {self.object_id}"
