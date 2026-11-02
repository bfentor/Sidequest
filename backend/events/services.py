import calendar
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from notifications.models import Kind
from notifications.services import followers_of, managers_of, notify
from posts.models import Post

from .models import CoHost, Event

# How far apart the occurrences of a recurring event are.
REPEAT_FREQUENCIES = ("weekly", "biweekly", "monthly")


def _add_months(moment, months):
    month_index = moment.month - 1 + months
    year, month = moment.year + month_index // 12, month_index % 12 + 1
    # The 31st becomes the last day of shorter months.
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


def _shift(moment, frequency, times):
    if frequency == "monthly":
        return _add_months(moment, times)
    return moment + timedelta(weeks=times * (1 if frequency == "weekly" else 2))


def announce(event):
    """Tell the organizer's followers about a published event, once.

    Unlisted events are never announced. `announced_at` is set either way, so
    the scheduler (publish_scheduled_events) doesn't come back to it.
    """
    if event.announced_at is not None:
        return
    if event.visibility != Event.Visibility.UNLISTED:
        Post.objects.create(author=event.organizer, event=event)
        notify(followers_of(event.organizer), Kind.NEW_EVENT, actor=event.organizer, event=event)
    event.announced_at = timezone.now()
    event.save(update_fields=["announced_at"])


def invite_co_hosts(event, profiles):
    """Ask profiles to co-host; they show on the event once they accept."""
    for profile in profiles:
        if profile == event.organizer:
            continue
        _link, created = CoHost.objects.get_or_create(event=event, profile=profile)
        if created:
            notify(managers_of(profile), Kind.CO_HOST_INVITE, actor=event.organizer, event=event)


@transaction.atomic
def publish_event(*, categories=(), co_hosts=(), repeat=None, **fields):
    """Create an event (or a series of them) and announce it if it's published now.

    `repeat` is {"frequency": weekly|biweekly|monthly, "count": occurrences}.
    Each occurrence is its own event; only the first one is announced.
    """
    first = Event.objects.create(**fields)
    occurrences = [first]
    if repeat:
        first.series_id = uuid.uuid4()
        first.save(update_fields=["series_id"])
        for times in range(1, repeat["count"]):
            occurrences.append(
                Event.objects.create(
                    **{
                        **fields,
                        "starts_at": _shift(first.starts_at, repeat["frequency"], times),
                        "ends_at": _shift(first.ends_at, repeat["frequency"], times),
                        "series_id": first.series_id,
                        # Followers hear about the series once, through the first date.
                        "announced_at": timezone.now(),
                    }
                )
            )

    for event in occurrences:
        event.categories.set(categories)
    invite_co_hosts(first, co_hosts)
    for event in occurrences[1:]:
        CoHost.objects.bulk_create(CoHost(event=event, profile=p) for p in co_hosts)

    if first.published_at is not None and first.published_at <= timezone.now():
        announce(first)
    return first


def publish_due():
    """Announce scheduled events whose time has come. Returns how many."""
    due = Event.objects.filter(
        announced_at__isnull=True,
        published_at__lte=timezone.now(),
        status=Event.Status.ACTIVE,
        removed_at__isnull=True,
    ).select_related("organizer")
    count = 0
    for event in due:
        announce(event)
        count += 1
    return count
