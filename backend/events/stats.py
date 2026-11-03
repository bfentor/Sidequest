"""Numbers for hosts: how a profile's events and following are doing."""

from datetime import timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from profiles.models import Follow, Profile

from .models import Attendance, Event, EventViewDay

# The dashboard looks this far back.
DAYS = 30


def count_view(event, viewer):
    """Add one to today's views of `event`, unless the viewer hosts it."""
    if (
        viewer is not None
        and Profile.objects.manageable_by(viewer.user).filter(pk=event.organizer_id).exists()
    ):
        return
    day, _ = EventViewDay.objects.get_or_create(event=event, date=timezone.localdate())
    EventViewDay.objects.filter(pk=day.pk).update(count=F("count") + 1)


def _per_day(queryset, field, days):
    """{date: count} of `queryset` rows by the local date of `field`."""
    rows = (
        queryset.annotate(day=TruncDate(field, tzinfo=timezone.get_current_timezone()))
        .values("day")
        .annotate(n=Count("pk"))
    )
    by_day = {row["day"]: row["n"] for row in rows}
    return [by_day.get(day, 0) for day in days]


def profile_stats(profile):
    """Daily views, RSVPs and new followers over the last DAYS days, and recent events."""
    today = timezone.localdate()
    days = [today - timedelta(days=offset) for offset in range(DAYS - 1, -1, -1)]
    since = timezone.now() - timedelta(days=DAYS)
    events = Event.objects.filter(organizer=profile, removed_at__isnull=True)

    view_rows = EventViewDay.objects.filter(event__in=events, date__gte=days[0])
    by_day = {row["date"]: row["n"] for row in view_rows.values("date").annotate(n=Sum("count"))}
    views = [by_day.get(day, 0) for day in days]
    rsvps = _per_day(
        Attendance.objects.filter(
            event__in=events,
            status__in=[Attendance.Status.GOING, Attendance.Status.INTERESTED],
            created_at__gte=since,
        ),
        "created_at",
        days,
    )
    new_followers = _per_day(
        Follow.objects.filter(followee=profile, created_at__gte=since), "created_at", days
    )

    recent = list(
        events.filter(starts_at__gte=since)
        .annotate(views=Sum("view_days__count", default=0))
        .order_by("-starts_at")[:20]
    )
    answers = Attendance.objects.filter(event__in=[event.pk for event in recent])
    going, interested = (
        dict(answers.filter(status=status).values_list("event").annotate(n=Count("pk")))
        for status in (Attendance.Status.GOING, Attendance.Status.INTERESTED)
    )
    return {
        "days": days,
        "views": views,
        "rsvps": rsvps,
        "new_followers": new_followers,
        "followers": Follow.objects.filter(followee=profile).count(),
        "events": [
            {
                "id": event.pk,
                "title": event.title,
                "starts_at": event.starts_at,
                "views": event.views,
                "going": going.get(event.pk, 0),
                "interested": interested.get(event.pk, 0),
            }
            for event in recent
        ],
    }
