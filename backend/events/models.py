from django.contrib.gis.db import models as gis_models
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import models
from django.utils import timezone
from django.utils.translation import get_language

from moderation.visibility import hidden_profiles, muted_profiles, private_profiles
from profiles.models import Profile


class EventQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Not removed, and not organized by a profile blocked either way or removed."""
        return (
            self.filter(removed_at__isnull=True, organizer__removed_at__isnull=True)
            .exclude(organizer__in=hidden_profiles(viewer))
            .exclude(organizer__in=private_profiles(viewer))
        )

    def in_feeds_of(self, viewer):
        """Like visible_to, also leaving out profiles the viewer muted."""
        return self.visible_to(viewer).exclude(organizer__in=muted_profiles(viewer))

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
    # How many can attend; empty for no limit. Beyond it, people join the waitlist.
    capacity = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Set by moderators; hides the event everywhere.
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = EventQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["starts_at", "id"]),
            models.Index(fields=["ends_at"]),
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
