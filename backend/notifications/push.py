"""Sending push notifications through Expo's push service.

https://docs.expo.dev/push-notifications/sending-notifications/
"""

import json
import logging
import urllib.request
from collections import Counter
from datetime import timedelta
from itertools import batched

from django.conf import settings
from django.utils import formats, timezone, translation
from django.utils.translation import gettext as _

from .models import Kind, Notification, PushDevice, PushSetting

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepts at most 100 messages per request.
BATCH_SIZE = 100
# Older notifications aren't pushed any more; they only stay in the inbox.
MAX_AGE = timedelta(hours=12)


def render(notification) -> tuple[str, str]:
    """Title and body of a push, in the active language."""
    actor = notification.actor.display_name if notification.actor else ""
    event = notification.event
    # A deleted event's title is kept in the message.
    title = event.title if event else (notification.message or "Sidequest")
    match notification.kind:
        case Kind.NEW_FOLLOWER:
            return "Sidequest", _("%(name)s started following you.") % {"name": actor}
        case Kind.FOLLOW_REQUEST:
            return "Sidequest", _("%(name)s asked to follow you.") % {"name": actor}
        case Kind.ORGANIZATION_INVITE:
            return "Sidequest", _("%(name)s invited you to join them.") % {"name": actor}
        case Kind.FOLLOW_ACCEPTED:
            return "Sidequest", _("%(name)s accepted your follow request.") % {"name": actor}
        case Kind.NEW_EVENT:
            return title, _("New event from %(name)s.") % {"name": actor}
        case Kind.EVENT_CHANGED:
            return title, _("The time or place of this event changed.")
        case Kind.EVENT_CANCELLED:
            return title, _("This event was cancelled.")
        case Kind.EVENT_POSTPONED:
            return title, _("This event was postponed.")
        case Kind.CO_HOST_INVITE:
            return title, _("%(name)s invited you to co-host this event.") % {"name": actor}
        case Kind.EVENT_REMINDER:
            starts = formats.date_format(timezone.localtime(event.starts_at), "TIME_FORMAT")
            return title, _("Starts at %(time)s.") % {"time": starts}
        case Kind.WAITLIST_PROMOTED:
            return title, _("A spot opened up: you're going!")
        case Kind.ANNOUNCEMENT:
            return title, f"{actor}: {notification.message}"
        case Kind.MENTION:
            return "Sidequest", _("%(name)s mentioned you.") % {"name": actor}
        case Kind.COMMENT:
            return "Sidequest", _("%(name)s commented.") % {"name": actor}
        case Kind.REACTION:
            return "Sidequest", _("%(name)s liked your post.") % {"name": actor}
    return "Sidequest", ""


def link(notification) -> str:
    """Where tapping the notification takes the app."""
    if notification.post_id:
        return f"/posts/{notification.post_id}"
    if notification.event_id:
        return f"/events/{notification.event_id}"
    if notification.kind == Kind.FOLLOW_REQUEST:
        return "/follow-requests"
    if notification.kind == Kind.ORGANIZATION_INVITE:
        return "/invitations"
    if notification.kind in (Kind.NEW_FOLLOWER, Kind.FOLLOW_ACCEPTED) and notification.actor:
        return f"/profiles/{notification.actor.handle}"
    return "/notifications"


def send_to_expo(messages: list[dict]) -> list[dict]:
    """POST one batch; returns Expo's tickets, one per message, in order."""
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    request = urllib.request.Request(
        EXPO_PUSH_URL, data=json.dumps(messages).encode(), headers=headers, method="POST"
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["data"]


def send_pending() -> int:
    """Push every notification that hasn't been pushed yet. Returns how many messages went out."""
    now = timezone.now()
    pending = list(
        Notification.objects.filter(pushed_at__isnull=True)
        .select_related("recipient", "actor", "event")
        .order_by("created_at")[:1000]
    )
    if not pending:
        return 0

    disabled = set(
        PushSetting.objects.filter(
            enabled=False, user__in={n.recipient_id for n in pending}
        ).values_list("user_id", "kind")
    )
    devices = {}
    for device in PushDevice.objects.filter(user__in={n.recipient_id for n in pending}):
        devices.setdefault(device.user_id, []).append(device.token)

    # (notification id, message) for every device of every recipient who wants it.
    items = []
    for notification in pending:
        user = notification.recipient
        if notification.created_at < now - MAX_AGE or (user.pk, notification.kind) in disabled:
            continue
        with translation.override(user.language):
            title, body = render(notification)
        for token in devices.get(user.pk, []):
            message = {
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": {"url": link(notification)},
            }
            items.append((notification.pk, message))

    # A notification is done once all its messages are sent (or it had none to send).
    remaining = Counter(notification_id for notification_id, _ in items)
    done = {n.pk for n in pending if n.pk not in remaining}
    sent = 0
    for batch in batched(items, BATCH_SIZE, strict=False):
        try:
            tickets = send_to_expo([message for _, message in batch])
        except OSError:
            logger.exception("Sending push notifications failed; the rest go on the next run.")
            break
        for (notification_id, message), ticket in zip(batch, tickets, strict=False):
            if ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                PushDevice.objects.filter(token=message["to"]).delete()
            remaining[notification_id] -= 1
            if remaining[notification_id] == 0:
                done.add(notification_id)
        sent += len(batch)

    Notification.objects.filter(pk__in=done).update(pushed_at=now)
    return sent
