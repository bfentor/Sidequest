from django.db import transaction

from notifications.models import Kind
from notifications.services import notify

from .models import Attendance, Event


@transaction.atomic
def rsvp(event: Event, profile, wants: str) -> Attendance:
    """Set someone's RSVP. Wanting to go to a full event puts them on the waitlist."""
    # Lock the event so two people can't take the last spot at once.
    event = Event.objects.select_for_update().get(pk=event.pk)
    attendance = Attendance.objects.filter(event=event, profile=profile).first()
    was_going = attendance is not None and attendance.status == Attendance.Status.GOING

    status = wants
    if wants == Attendance.Status.GOING and not was_going and _is_full(event):
        status = Attendance.Status.WAITLISTED

    if attendance is None:
        attendance = Attendance.objects.create(event=event, profile=profile, status=status)
    elif attendance.status != status:
        attendance.status = status
        attendance.save(update_fields=["status", "updated_at"])

    if was_going and status != Attendance.Status.GOING:
        _promote_from_waitlist(event)
    return attendance


@transaction.atomic
def cancel(event: Event, profile) -> None:
    event = Event.objects.select_for_update().get(pk=event.pk)
    deleted = Attendance.objects.filter(event=event, profile=profile).first()
    if deleted is None:
        return
    was_going = deleted.status == Attendance.Status.GOING
    deleted.delete()
    if was_going:
        _promote_from_waitlist(event)


def _is_full(event: Event) -> bool:
    if event.capacity is None:
        return False
    return event.attendances.filter(status=Attendance.Status.GOING).count() >= event.capacity


def _promote_from_waitlist(event: Event) -> Attendance | None:
    """Give a freed spot to whoever has waited longest."""
    if _is_full(event):
        return None
    first = (
        event.attendances.filter(status=Attendance.Status.WAITLISTED)
        .order_by("updated_at", "pk")
        .first()
    )
    if first is not None:
        first.status = Attendance.Status.GOING
        first.save(update_fields=["status", "updated_at"])
        notify([first.profile], Kind.WAITLIST_PROMOTED, event=event)
    return first
