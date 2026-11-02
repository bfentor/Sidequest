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


class FeedFilterSerializer(serializers.Serializer):
    category = serializers.ListField(
        child=serializers.SlugField(),
        required=False,
        help_text="Category slugs; events in any of them.",
    )
    starts_after = serializers.DateTimeField(
        required=False, help_text="Events still going on after this time."
    )
    starts_before = serializers.DateTimeField(
        required=False, help_text="Events starting before this time."
    )
    free = serializers.BooleanField(required=False, default=False, help_text="Free events only.")


def filter_events(events, query_params):
    filters = FeedFilterSerializer(data=query_params)
    filters.is_valid(raise_exception=True)
    data = filters.validated_data
    return events.filtered(
        categories=data.get("category", []),
        starts_after=data.get("starts_after"),
        starts_before=data.get("starts_before"),
        free=data["free"],
    )


@extend_schema(parameters=[FeedFilterSerializer])
class UpcomingFeedView(generics.ListAPIView):
    """Ongoing and future events, soonest first."""

    serializer_class = EventSerializer
    pagination_class = UpcomingCursorPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        events = Event.objects.not_ended().in_feeds_of(viewer)
        return filter_events(events, self.request.query_params).for_display(viewer)


class NearbyQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    radius_km = serializers.FloatField(min_value=0.1, max_value=100, default=10)


@extend_schema(parameters=[NearbyQuerySerializer, FeedFilterSerializer])
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
        viewer = viewer_profile(self.request)
        events = Event.objects.not_ended().in_feeds_of(viewer)
        return (
            filter_events(events, self.request.query_params)
            .near(point, params.validated_data["radius_km"])
            .for_display(viewer)
        )


class FollowingQuerySerializer(serializers.Serializer):
    hide_past = serializers.BooleanField(
        required=False, default=False, help_text="Leave out posts about events that have ended."
    )


@extend_schema(parameters=[FollowingQuerySerializer])
class FollowingFeedView(generics.ListAPIView):
    """Posts from profiles the signed-in user follows (and their own), newest first.

    An event shared more than once shows only in its newest post.
    """

    serializer_class = PostSerializer
    pagination_class = NewestFirstCursorPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        params = FollowingQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        viewer = self.request.user.profile
        posts = Post.objects.following_feed_for(viewer).in_feeds_of(viewer).latest_per_event()
        if params.validated_data["hide_past"]:
            posts = posts.without_past_events()
        return posts.for_display(viewer)
