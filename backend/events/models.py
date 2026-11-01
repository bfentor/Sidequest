from django.contrib.gis.db import models as gis_models
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import models
from django.utils import timezone

from profiles.models import Profile


class EventQuerySet(models.QuerySet):
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
