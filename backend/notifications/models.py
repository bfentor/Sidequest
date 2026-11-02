from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Kind(models.TextChoices):
    NEW_FOLLOWER = "new_follower", _("New followers")
    FOLLOW_REQUEST = "follow_request", _("Follow requests")
    FOLLOW_ACCEPTED = "follow_accepted", _("Accepted follow requests")
    NEW_EVENT = "new_event", _("New events from people you follow")
    EVENT_CHANGED = "event_changed", _("Changes to events you're going to")
    EVENT_CANCELLED = "event_cancelled", _("Cancelled events")
    EVENT_REMINDER = "event_reminder", _("Event reminders")
    WAITLIST_PROMOTED = "waitlist_promoted", _("A spot opened up for you")
    ANNOUNCEMENT = "announcement", _("Announcements from organizers")
    MENTION = "mention", _("Mentions")
    COMMENT = "comment", _("Comments")
    REACTION = "reaction", _("Likes")


class Notification(models.Model):
    """One entry in someone's inbox; also sent as a push notification unless they turned it off."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=30, choices=Kind.choices)
    actor = models.ForeignKey(
        "profiles.Profile", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    event = models.ForeignKey(
        "events.Event", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    post = models.ForeignKey(
        "posts.Post", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    # Free text some kinds carry, e.g. an organizer's announcement.
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    # When the push went out (or was skipped); empty while waiting for send_push_notifications.
    pushed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["pushed_at", "created_at"]),
        ]

    def __str__(self):
        return f"{self.kind} for {self.recipient}"


class PushDevice(models.Model):
    """A phone that can receive push notifications, by its Expo push token."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_devices"
    )
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Push device of {self.user}"


class PushSetting(models.Model):
    """Someone turning push off (or back on) for one kind. Missing means on."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_settings"
    )
    kind = models.CharField(max_length=30, choices=Kind.choices)
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "kind"], name="unique_push_setting"),
        ]

    def __str__(self):
        return f"{self.kind} push {'on' if self.enabled else 'off'} for {self.user}"
