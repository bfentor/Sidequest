from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import attendees_of, notify
from profiles.models import Profile
from profiles.permissions import CanActAsOwner
from profiles.serializers import ProfileSummarySerializer

from . import attendance as rsvps
from . import geocoding
from .models import Category, CoHost, Event
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
        return Event.objects.visible_to(viewer).for_display(viewer)

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
        if event.status == Event.Status.CANCELLED and request.method == "PUT":
            raise ValidationError(_("This event was cancelled."))
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


def _co_host_links(request, pk):
    """Co-host links of this event (its whole series) for profiles the user manages."""
    event = get_object_or_404(Event.objects.visible_to(viewer_profile(request)), pk=pk)
    managed = Profile.objects.manageable_by(request.user)
    events = Event.objects.filter(series_id=event.series_id) if event.series_id else [event]
    return CoHost.objects.filter(event__in=events, profile__in=managed)


class CoHostInvitationsView(APIView):
    """Pending co-host invitations of this event for profiles you manage."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=ProfileSummarySerializer(many=True))
    def get(self, request, pk):
        pending = _co_host_links(request, pk).filter(event_id=pk, accepted_at__isnull=True)
        profiles = [link.profile for link in pending.select_related("profile__avatar")]
        return Response(ProfileSummarySerializer(profiles, many=True).data)


class CoHostAnswerView(APIView):
    """Accept co-hosting as one of your profiles (POST), or decline or stop (DELETE).

    Answering for one date of a series answers for all of them.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _links(self, request, pk, handle):
        links = _co_host_links(request, pk).filter(profile__handle=handle)
        if not links.exists():
            raise ValidationError({"handle": _("This profile wasn't invited to co-host.")})
        return links

    @extend_schema(request=None, responses={204: None})
    def post(self, request, pk, handle):
        self._links(request, pk, handle).update(accepted_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, pk, handle):
        self._links(request, pk, handle).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        events = Event.objects.filter(organizer__in=managed).for_display(viewer)
        now = timezone.now()
        if self.request.query_params.get("when") == "past":
            return events.filter(ends_at__lt=now).order_by("-starts_at", "-id")
        return events.filter(ends_at__gte=now).order_by("starts_at", "id")
