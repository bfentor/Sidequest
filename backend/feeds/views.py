"""The three main feeds.

Each feed is a read-only list endpoint with its own ordering and pagination.
New feed types (trending, by category, ...) can be added as more views here.
"""

from django.contrib.gis.geos import Point
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers

from events.models import Event
from events.serializers import EventSerializer, NearbyEventSerializer
from moderation.visibility import viewer_profile
from posts.models import Post
from posts.serializers import PostSerializer

from .pagination import NearbyPagination, NewestFirstCursorPagination, UpcomingCursorPagination


class UpcomingFeedView(generics.ListAPIView):
    """Ongoing and future events, soonest first."""

    serializer_class = EventSerializer
    pagination_class = UpcomingCursorPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return (
            Event.objects.not_ended()
            .in_feeds_of(viewer)
            .select_related("organizer__avatar")
            .prefetch_related("categories")
        )


class NearbyQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    radius_km = serializers.FloatField(min_value=0.1, max_value=100, default=10)


@extend_schema(parameters=[NearbyQuerySerializer])
class NearbyFeedView(generics.ListAPIView):
    """Ongoing and future events within a radius of the given position, nearest first.

    The position is only used for this query and is never stored.
    """

    serializer_class = NearbyEventSerializer
    pagination_class = NearbyPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        params = NearbyQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        point = Point(params.validated_data["lng"], params.validated_data["lat"], srid=4326)
        return (
            Event.objects.not_ended()
            .in_feeds_of(viewer_profile(self.request))
            .near(point, params.validated_data["radius_km"])
            .select_related("organizer__avatar")
            .prefetch_related("categories")
        )


class FollowingFeedView(generics.ListAPIView):
    """Posts from profiles the signed-in user follows (and their own), newest first."""

    serializer_class = PostSerializer
    pagination_class = NewestFirstCursorPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        viewer = self.request.user.profile
        return (
            Post.objects.following_feed_for(viewer)
            .in_feeds_of(viewer)
            .select_related("author__avatar", "event__organizer__avatar")
            .prefetch_related("event__categories")
        )
