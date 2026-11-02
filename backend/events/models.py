from django.contrib.gis.db import models as gis_models
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.contrib.postgres.indexes import GinIndex, OpClass
from django.db import models
from django.db.models.functions import Upper
from django.utils import timezone
from django.utils.translation import get_language

from moderation.visibility import hidden_profiles, muted_profiles, private_profiles
from profiles.models import Profile


class EventQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Events the viewer may open.

        Published public or unlisted events, followers-only events of profiles they
        follow, and every event (drafts too) of profiles they manage. Never removed
        events, or ones whose organizer is removed, blocked either way or private.
        """
        queryset = (
            self.filter(removed_at__isnull=True, organizer__removed_at__isnull=True)
            .exclude(organizer__in=hidden_profiles(viewer))
            .exclude(organizer__in=private_profiles(viewer))
        )
        audience = models.Q(visibility__in=[Event.Visibility.PUBLIC, Event.Visibility.UNLISTED])
        if viewer is None:
            return queryset.filter(audience, published_at__lte=timezone.now())
        followed = Profile.objects.filter(followed_by__follower=viewer)
        audience |= models.Q(visibility=Event.Visibility.FOLLOWERS, organizer__in=followed)
        managed = Profile.objects.manageable_by(viewer.user)
        return queryset.filter(
            (audience & models.Q(published_at__lte=timezone.now()))
            | models.Q(organizer__in=managed)
        )

    def in_feeds_of(self, viewer):
        """What feeds list: visible, published, not unlisted or cancelled, nor muted."""
        return (
            self.visible_to(viewer)
            .filter(published_at__lte=timezone.now())
            .exclude(visibility=Event.Visibility.UNLISTED)
            .exclude(status=Event.Status.CANCELLED)
            .exclude(organizer__in=muted_profiles(viewer))
        )

    def with_attendance(self, viewer):
        """Annotate attendance counts and the viewer's own status (None if not attending)."""
        going = models.Q(attendances__status=Attendance.Status.GOING)
        queryset = self.annotate(
            going_count=models.Count("attendances", filter=going),
            interested_count=models.Count(
                "attendances", filter=models.Q(attendances__status=Attendance.Status.INTERESTED)
            ),
            waitlist_count=models.Count(
                "attendances", filter=models.Q(attendances__status=Attendance.Status.WAITLISTED)
            ),
        )
        if viewer is None:
            return queryset.annotate(my_status=models.Value(None, models.CharField()))
        mine = Attendance.objects.filter(event=models.OuterRef("pk"), profile=viewer)
        return queryset.annotate(my_status=models.Subquery(mine.values("status")[:1]))

    def for_display(self, viewer):
        """Everything an event's serializer shows, fetched in as few queries as possible."""
        return (
            self.with_attendance(viewer)
            .select_related("organizer__avatar", "cover", "students_of")
            .prefetch_related("categories", "co_host_links__profile__avatar")
        )

    def filtered(self, *, categories=(), starts_after=None, starts_before=None, free=False):
        """Feed filters: any of the categories, overlapping a time window, free only."""
        queryset = self
        if categories:
            in_category = Event.categories.through.objects.filter(
                event=models.OuterRef("pk"), category__slug__in=categories
            )
            queryset = queryset.filter(models.Exists(in_category))
        # Overlapping the window, so events already going on count too.
        if starts_after is not None:
            queryset = queryset.filter(ends_at__gt=starts_after)
        if starts_before is not None:
            queryset = queryset.filter(starts_at__lt=starts_before)
        if free:
            queryset = queryset.filter(models.Q(price__isnull=True) | models.Q(price=0))
        return queryset

    def not_ended(self):
        """Events that are ongoing or yet to start."""
        return self.filter(ends_at__gte=timezone.now())

    def near(self, point, radius_km):
        """Events within `radius_km` of `point`, nearest first, annotated with `distance`."""
        return (
            self.filter(location__dwithin=(point, D(km=radius_km)))
            .annotate(distance=Distance("location", point))
            .order_by("distance", "starts_at", "id")
        )


class Category(models.Model):
    """What an event is about. Also used for people's interests.

    Names are stored in every language so admins can add categories without a release.
    """

    slug = models.SlugField(unique=True)
    name_en = models.CharField(max_length=60)
    name_fi = models.CharField(max_length=60)
    name_sv = models.CharField(max_length=60)
    # Material Symbol shown next to the name.
    icon = models.CharField(max_length=40, blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "slug"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name_en

    @property
    def name(self):
        """The name in the active language (the request's Accept-Language)."""
        return getattr(self, f"name_{get_language()}", None) or self.name_en


class Event(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public"
        # Only followers of the organizer see it.
        FOLLOWERS = "followers"
        # Anyone with the link; never listed in feeds.
        UNLISTED = "unlisted"

    class Status(models.TextChoices):
        ACTIVE = "active"
        # Not happening at the announced time; a new time may follow.
        POSTPONED = "postponed"
        CANCELLED = "cancelled"

    organizer = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    venue_name = models.CharField(max_length=200, blank=True)
    address = models.CharField(max_length=300, blank=True)
    # Geography (not geometry) so distances are computed on the globe in metres.
    # Empty for online events, which then don't appear in the nearby feed.
    location = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name="events")
    cover = models.ForeignKey(
        "images.Image",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cover_of_event",
    )
    # For online (or hybrid) events.
    online_url = models.URLField(blank=True)
    # Empty for free events.
    price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    ticket_url = models.URLField(blank=True)
    # E.g. 18 for parties with alcohol; checked when someone RSVPs.
    min_age = models.PositiveSmallIntegerField(null=True, blank=True)
    # Only verified students of this university can RSVP.
    students_of = models.ForeignKey(
        "students.University",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # How many can attend; empty for no limit. Beyond it, people join the waitlist.
    capacity = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Set by moderators; hides the event everywhere.
    removed_at = models.DateTimeField(null=True, blank=True)
    visibility = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.PUBLIC
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    # Empty for drafts; in the future for scheduled events.
    published_at = models.DateTimeField(null=True, blank=True, default=timezone.now)
    # When followers were told about it (an announcement post and notifications).
    announced_at = models.DateTimeField(null=True, blank=True)
    # Shared by the occurrences of a recurring event.
    series_id = models.UUIDField(null=True, blank=True, db_index=True)
    co_hosts = models.ManyToManyField(
        Profile, through="CoHost", blank=True, related_name="co_hosted_events"
    )

    objects = EventQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["starts_at", "id"]),
            models.Index(fields=["ends_at"]),
            # Typo-tolerant title search (search/views.py).
            GinIndex(OpClass(Upper("title"), name="gin_trgm_ops"), name="event_title_trgm"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="event_ends_after_start",
            ),
        ]

    def __str__(self):
        return self.title


class Attendance(models.Model):
    """Someone's RSVP to an event."""

    class Status(models.TextChoices):
        GOING = "going"
        INTERESTED = "interested"
        # Wanted to go when the event was full; promoted in order when a spot opens.
        WAITLISTED = "waitlisted"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendances")
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="attendances")
    status = models.CharField(max_length=20, choices=Status.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "profile"], name="unique_attendance"),
        ]
        indexes = [models.Index(fields=["event", "status", "updated_at"])]

    def __str__(self):
        return f"{self.profile} {self.status} {self.event}"


class CoHost(models.Model):
    """Another profile running an event together with its organizer; shown once they accept."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="co_host_links")
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="co_host_links")
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "profile"], name="unique_co_host"),
        ]

    def __str__(self):
        return f"{self.profile} co-hosts {self.event}"
