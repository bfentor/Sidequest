"""Keeping a profile's events in step with a calendar it already keeps (an iCal feed).

Each event in the feed (each occurrence, for repeating ones) becomes an
event in Sidequest, matched by its ID in the calendar, so later syncs update
it instead of adding it again. Run by sync_calendars (see CRONJOBS.md).
"""

import logging
from datetime import datetime, time, timedelta

import icalendar
import recurring_ical_events
from django.contrib.gis.geos import Point
from django.db import transaction
from django.utils import timezone

from config.fetch import fetch_text
from moderation import filters
from notifications.models import Kind
from notifications.services import attendees_of, notify

from .models import Attendance, CalendarSource, Event
from .services import announce

logger = logging.getLogger(__name__)

MAX_BYTES = 2 * 1024 * 1024
# How far ahead events are imported, and at most how many per calendar.
HORIZON = timedelta(days=180)
MAX_EVENTS = 200
# Events without an end are given this long.
DEFAULT_DURATION = timedelta(hours=2)
# Changing any of these tells everyone going or interested (as editing in the app does).
NOTIFY_ON_CHANGE = ("starts_at", "ends_at", "venue_name", "address", "location", "online_url")


class SyncError(Exception):
    """The feed couldn't be used. `args[0]` is a code the app explains to the hosts."""

    FETCH = "fetch"  # Not reachable, not public, or not a calendar.
    PARSE = "parse"  # Not valid iCal.


def feed_url(url):
    """The https address for a webcal:// link (how calendar apps share feeds)."""
    return "https://" + url[len("webcal://") :] if url.startswith("webcal://") else url


def _moment(value):
    """A timezone-aware datetime; all-day dates start at midnight local time."""
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value)
    return timezone.make_aware(datetime.combine(value, time()))


def _text(component, name, limit):
    value = component.get(name)
    return str(value).strip()[:limit] if value is not None else ""


def occurrences(ics_text, now):
    """{key: event fields} for the feed's events that haven't ended, up to HORIZON ahead."""
    try:
        calendar = icalendar.Calendar.from_ical(ics_text)
        found = recurring_ical_events.of(calendar).between(now, now + HORIZON)
        repeating = {
            str(component.get("UID"))
            for component in calendar.walk("VEVENT")
            if "RRULE" in component
        }
    except Exception as error:  # Anything malformed in the feed.
        raise SyncError(SyncError.PARSE) from error

    events = {}
    for component in found:
        uid = _text(component, "UID", 400)
        if not uid:
            continue
        # Each occurrence of a repeating event is its own event, keyed by which one it is.
        recurrence = component.get("RECURRENCE-ID") if uid in repeating else None
        key = f"{uid}|{_moment(recurrence.dt).isoformat()}" if recurrence else uid
        starts_at = _moment(component.start)
        # All-day events end at the next midnight; ones without an end, at their start.
        ends_at = _moment(component.end)
        if ends_at <= starts_at:
            ends_at = starts_at + DEFAULT_DURATION
        if ends_at <= now:
            continue
        place = _text(component, "LOCATION", 300)
        online = place.startswith(("http://", "https://"))
        geo = component.get("GEO")
        events[key] = {
            "title": _text(component, "SUMMARY", 200) or "(untitled)",
            "description": _text(component, "DESCRIPTION", 5000),
            "starts_at": starts_at,
            "ends_at": ends_at,
            "address": "" if online else place,
            "online_url": place if online else "",
            "location": Point(geo.longitude, geo.latitude, srid=4326) if geo else None,
            "status": Event.Status.CANCELLED
            if _text(component, "STATUS", 20).upper() == "CANCELLED"
            else Event.Status.ACTIVE,
        }
        if len(events) >= MAX_EVENTS:
            break
    return events


def sync(source):
    """Bring the source's profile's events in line with the feed.

    Returns (created, updated, removed). Records the outcome on the source;
    raises SyncError if the feed couldn't be fetched or read.
    """
    now = timezone.now()
    try:
        fetched = fetch_text(
            feed_url(source.url),
            accept="text/calendar",
            kinds=("calendar", "text/plain", "octet-stream"),
            max_bytes=MAX_BYTES,
        )
        if fetched is None:
            raise SyncError(SyncError.FETCH)
        wanted = occurrences(fetched[1], now)
    except SyncError as error:
        source.error = error.args[0]
        source.save(update_fields=["error"])
        raise

    # The first sync brings in what's already planned quietly; later ones announce new events.
    first_sync = source.synced_at is None
    created = updated = removed = 0
    with transaction.atomic():
        existing = {event.source_uid: event for event in source.events.filter(ends_at__gt=now)}
        for key, fields in wanted.items():
            event = existing.pop(key, None)
            if event is None:
                event = Event.objects.create(
                    organizer=source.profile,
                    source=source,
                    source_uid=key,
                    published_at=now,
                    announced_at=now if first_sync else None,
                    **fields,
                )
                if not first_sync:
                    announce(event)
                filters.flag(event, f"{event.title}\n{event.description}")
                created += 1
                continue
            changes = {
                name: value for name, value in fields.items() if getattr(event, name) != value
            }
            if not changes:
                continue
            notify_kind = None
            if changes.get("status") == Event.Status.CANCELLED:
                notify_kind = Kind.EVENT_CANCELLED
            elif any(name in changes for name in NOTIFY_ON_CHANGE):
                notify_kind = Kind.EVENT_CHANGED
            if "starts_at" in changes:
                changes["reminded_at"] = None
            for name, value in changes.items():
                setattr(event, name, value)
            event.save()
            if notify_kind:
                notify(attendees_of(event), notify_kind, actor=event.organizer, event=event)
            updated += 1

        # Upcoming events that left the calendar: gone if nobody answered, otherwise cancelled.
        for event in existing.values():
            if Attendance.objects.filter(event=event).exists():
                if event.status != Event.Status.CANCELLED:
                    event.status = Event.Status.CANCELLED
                    event.save(update_fields=["status", "updated_at"])
                    notify(
                        attendees_of(event),
                        Kind.EVENT_CANCELLED,
                        actor=event.organizer,
                        event=event,
                    )
            else:
                event.delete()
            removed += 1

        source.synced_at = now
        source.error = ""
        source.save(update_fields=["synced_at", "error"])
    return created, updated, removed


def sync_all():
    """Sync every calendar; returns how many synced without errors."""
    ok = 0
    for source in CalendarSource.objects.select_related("profile"):
        try:
            sync(source)
            ok += 1
        except SyncError:
            logger.info("Calendar %s didn't sync: %s", source.pk, source.error)
    return ok
