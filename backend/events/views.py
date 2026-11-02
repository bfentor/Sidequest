from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from moderation.visibility import viewer_profile
from profiles.permissions import CanActAsOwner

from . import attendance as rsvps
from .models import Category, Event
from .serializers import (
    AttendanceSummarySerializer,
    CategorySerializer,
    EventSerializer,
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
