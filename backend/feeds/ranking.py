"""How the Trending and For you feeds rank events.

Scores are SQL expressions, so ranking and paging happen in the database.
The weights are deliberately simple and kept here so they're easy to tune.
"""

from datetime import timedelta

from django.contrib.gis.db.models.functions import Distance
from django.db import models
from django.db.models.functions import Cast, Coalesce, Extract, Least, Ln
from django.utils import timezone

from config.db import count_of
from events.models import Attendance, Event
from profiles.models import Follow, Profile

# RSVPs from this far back count towards trending.
TRENDING_WINDOW = timedelta(days=7)

# For you: points for each signal.
INTEREST_MATCH = 3.0
FOLLOWS_HOST = 4.0
PER_FRIEND_GOING = 2.0
MAX_FRIENDS_COUNTED = 5
# Times ln(1 + RSVPs), so popularity helps without drowning everything else.
POPULARITY = 1.0
# Fully earned on the spot, halved at NEARBY_HALF_KM away.
NEARBY = 3.0
NEARBY_HALF_KM = 5.0
# Lost per week until the event starts.
PER_WEEK_AWAY = 1.0


def points(condition, weight):
    return models.Case(
        models.When(condition, then=models.Value(weight)),
        default=models.Value(0.0),
        output_field=models.FloatField(),
    )


def trending(events):
    """Events gaining RSVPs lately, most first; going counts double interested."""
    recent = Attendance.objects.filter(
        event=models.OuterRef("pk"), updated_at__gte=timezone.now() - TRENDING_WINDOW
    )
    return (
        events.annotate(
            trend=2 * count_of(recent.filter(status=Attendance.Status.GOING))
            + count_of(recent.filter(status=Attendance.Status.INTERESTED))
        )
        .filter(trend__gt=0)
        .order_by("-trend", "starts_at", "pk")
    )


def for_you(events, viewer: Profile, point=None):
    """Events ranked for `viewer`, best first.

    Signals: the event's categories among the viewer's interests, hosted or
    co-hosted by someone they follow, friends going (unless those friends hide
    their attendance), popularity, how close it is (when `point` is given), and
    how soon. Events the viewer already answered or runs themselves are left out.
    """
    followed = Follow.objects.filter(follower=viewer).values("followee")
    in_interests = Event.categories.through.objects.filter(
        event=models.OuterRef("pk"), category__in=viewer.interests.all()
    )
    co_hosted_by_followed = Event.co_hosts.through.objects.filter(
        event=models.OuterRef("pk"), profile__in=followed, accepted_at__isnull=False
    )
    answered = Attendance.objects.filter(event=models.OuterRef("pk"))
    responses = answered.filter(
        status__in=[Attendance.Status.GOING, Attendance.Status.INTERESTED]
    )
    friends_going = responses.filter(profile__in=followed, profile__hide_attendance=False)
    days_away = Extract(models.F("starts_at") - timezone.now(), "epoch") / 86400

    score = (
        points(models.Exists(in_interests), INTEREST_MATCH)
        + points(
            models.Q(organizer__in=followed) | models.Exists(co_hosted_by_followed),
            FOLLOWS_HOST,
        )
        + PER_FRIEND_GOING * Least(count_of(friends_going), MAX_FRIENDS_COUNTED)
        + POPULARITY * Ln(1.0 + Cast(count_of(responses), models.FloatField()))
        # Ongoing events (negative days away) aren't rewarded for having started.
        - PER_WEEK_AWAY * models.Func(days_away, 0.0, function="GREATEST") / 7
    )
    if point is not None:
        km = Cast(Distance("location", point), models.FloatField()) / 1000
        score += Coalesce(NEARBY / (1 + km / NEARBY_HALF_KM), 0.0)

    return (
        events.exclude(models.Exists(answered.filter(profile=viewer)))
        .exclude(organizer__in=Profile.objects.manageable_by(viewer.user))
        .annotate(score=models.ExpressionWrapper(score, output_field=models.FloatField()))
        .order_by("-score", "starts_at", "pk")
    )
