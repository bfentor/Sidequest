"""The weekly email digest: the coming week's events, for people who turned it on.

Sent by send_weekly_digest (see CRONJOBS.md). Plain text in each person's
language, with a one-click unsubscribe header (RFC 8058), which large
mailbox providers expect from regular email.
"""

import email.policy
from datetime import timedelta

from allauth.account.models import EmailAddress
from django.conf import settings
from django.core import signing
from django.core.mail import EmailMessage
from django.db import transaction
from django.urls import reverse
from django.utils import formats, timezone, translation
from django.utils.translation import gettext as _

from events.models import Attendance, Event
from profiles.models import Profile

# The digest covers events starting this soon.
WINDOW = timedelta(days=7)
# Someone gets at most one digest this often, however often the job runs.
MIN_INTERVAL = timedelta(days=6)
# Events listed per section.
LIMIT = 10
UNSUBSCRIBE_SALT = "digest-unsubscribe"


class DigestEmail(EmailMessage):
    """Keeps the unsubscribe link on one line.

    Folding would otherwise encode the long URL (RFC 2047), which mail
    clients don't decode in List-Unsubscribe. RFC 5322 allows lines of up to
    998 characters.
    """

    def message(self, *, policy=email.policy.default):
        return super().message(policy=policy.clone(max_line_length=998))


def unsubscribe_token(user):
    return signing.dumps(user.pk, salt=UNSUBSCRIBE_SALT)


def user_for_token(token):
    """The user a token was made for, or None if it's not genuine."""
    from accounts.models import User

    try:
        pk = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        return None
    return User.objects.filter(pk=pk).first()


def events_for(profile, now):
    """(going or interested, new from people followed) in the coming week."""
    upcoming = (
        Event.objects.in_feeds_of(profile)
        .filter(starts_at__gte=now, starts_at__lt=now + WINDOW)
        .select_related("organizer")
        .order_by("starts_at")
    )
    attending = upcoming.filter(
        attendances__profile=profile,
        attendances__status__in=[Attendance.Status.GOING, Attendance.Status.INTERESTED],
    ).distinct()[:LIMIT]
    followed = Profile.objects.filter(followed_by__follower=profile)
    from_followed = upcoming.filter(organizer__in=followed).exclude(attendances__profile=profile)[
        :LIMIT
    ]
    return list(attending), list(from_followed)


def _line(event):
    when = formats.date_format(timezone.localtime(event.starts_at), "DATETIME_FORMAT")
    place = event.venue_name or event.address
    details = " · ".join(filter(None, [when, place, event.organizer.display_name]))
    return f"- {event.title}\n  {details}\n  {settings.FRONTEND_URL}/events/{event.pk}"


def compose(attending, from_followed):
    """Subject and body of one digest, in the active language."""
    sections = []
    if attending:
        sections.append(_("Your week:") + "\n\n" + "\n\n".join(map(_line, attending)))
    if from_followed:
        sections.append(
            _("New from people you follow:") + "\n\n" + "\n\n".join(map(_line, from_followed))
        )
    footer = _(
        "You get this email because you turned on the weekly summary. "
        "Turn it off in Settings: %(url)s"
    ) % {"url": f"{settings.FRONTEND_URL}/settings"}
    return _("[Sidequest] Your week of events"), "\n\n\n".join([*sections, footer])


def send_due(base_url):
    """Send the digest to everyone due one; returns how many were sent.

    `base_url` is the API's address, for the unsubscribe link.
    """
    from accounts.models import User

    now = timezone.now()
    verified = EmailAddress.objects.filter(verified=True).values("user")
    due = User.objects.filter(is_active=True, email_digest=True, pk__in=verified).exclude(
        digest_sent_at__gt=now - MIN_INTERVAL
    )
    sent = 0
    for user in due.select_related("profile"):
        with transaction.atomic():
            claimed = (
                User.objects.filter(pk=user.pk)
                .exclude(digest_sent_at__gt=now - MIN_INTERVAL)
                .update(digest_sent_at=now)
            )
            if not claimed:
                continue
            attending, from_followed = events_for(user.profile, now)
            if not attending and not from_followed:
                continue
            unsubscribe = base_url + reverse(
                "digest-unsubscribe", kwargs={"token": unsubscribe_token(user)}
            )
            with translation.override(user.language):
                subject, body = compose(attending, from_followed)
            DigestEmail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                headers={
                    "List-Unsubscribe": f"<{unsubscribe}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
            ).send()
        sent += 1
    return sent
