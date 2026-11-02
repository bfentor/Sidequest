from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import attendees_of, notify
from profiles.models import Profile
from profiles.permissions import CanActAsOwner

from . import attendance as rsvps
from . import geocoding
from .models import Category, Event
from .serializers import (
    AttendanceSummarySerializer,
    CategorySerializer,
    EventSerializer,
    GeocodeResultSerializer,
    RsvpSerializer,
    attendance_summary,
)


class EventViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Create and manage single events. Listing happens through the feeds."""

    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanActAsOwner]
    owner_field = "organizer"
    throttle_scope = "events"
    http_method_names = ["get", "post", "patch", "delete", "options"]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return (
            Event.objects.visible_to(viewer)
            .with_attendance(viewer)
            .select_related("organizer__avatar")
            .prefetch_related("categories")
        )

    def perform_destroy(self, event):
        # The notification can't point at a deleted event, so it keeps the title.
        notify(
            attendees_of(event), Kind.EVENT_CANCELLED, actor=event.organizer, message=event.title
        )
        event.delete()

    @extend_schema(
        request=RsvpSerializer,
        responses={200: AttendanceSummarySerializer},
        methods=["PUT"],
        description="RSVP to the event.",
    )
    @extend_schema(
        request=None,
        responses={200: AttendanceSummarySerializer},
        methods=["DELETE"],
        description="Withdraw your RSVP.",
    )
    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="rsvps",
        # The viewset leaves out PUT (events are edited with PATCH); this route needs it.
        http_method_names=["put", "delete", "options"],
    )
    def attendance(self, request, pk=None):
        # Not get_object(): anyone who can see the event may RSVP, not only its organizer.
        event = get_object_or_404(self.get_queryset(), pk=pk)
        profile = request.user.profile
        if request.method == "PUT":
            serializer = RsvpSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            rsvps.rsvp(event, profile, serializer.validated_data["status"])
        else:
            rsvps.cancel(event, profile)
        return Response(attendance_summary(self.get_queryset().get(pk=pk), profile))


class CategoryListView(generics.ListAPIView):
    """Every category, in display order, named in the request's language."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class GeocodeView(APIView):
    """Search for an address or place, for the event form's location."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "geocode"

    @extend_schema(
        parameters=[OpenApiParameter("q", str, required=True, description="What to look for.")],
        responses=GeocodeResultSerializer(many=True),
    )
    def get(self, request):
        results = geocoding.search(request.query_params.get("q", ""), request.LANGUAGE_CODE)
        return Response(GeocodeResultSerializer(results, many=True).data)


class ManagedEventsPagination(LimitOffsetPagination):
    default_limit = 30
    max_limit = 100


class ManagedEventsView(generics.ListAPIView):
    """Events organized by the signed-in user or their organizations: upcoming, or past."""

    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ManagedEventsPagination

    @extend_schema(
        parameters=[OpenApiParameter("when", enum=["upcoming", "past"], default="upcoming")]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        viewer = self.request.user.profile
        managed = Profile.objects.manageable_by(self.request.user)
        events = (
            Event.objects.filter(organizer__in=managed)
            .with_attendance(viewer)
            .select_related("organizer__avatar", "cover")
            .prefetch_related("categories")
        )
        now = timezone.now()
        if self.request.query_params.get("when") == "past":
            return events.filter(ends_at__lt=now).order_by("-starts_at", "-id")
        return events.filter(ends_at__gte=now).order_by("starts_at", "id")
