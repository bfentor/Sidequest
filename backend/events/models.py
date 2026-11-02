from django.contrib.gis.db import models as gis_models
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import models
from django.utils import timezone

from moderation.visibility import hidden_profiles, muted_profiles
from profiles.models import Profile


class EventQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Not removed, and not organized by a profile blocked either way or removed."""
        return self.filter(removed_at__isnull=True, organizer__removed_at__isnull=True).exclude(
            organizer__in=hidden_profiles(viewer)
        )

    def in_feeds_of(self, viewer):
        """Like visible_to, also leaving out profiles the viewer muted."""
        return self.visible_to(viewer).exclude(organizer__in=muted_profiles(viewer))

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
