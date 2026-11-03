import csv
import io

from django.db.models import Avg, Count, Exists, OuterRef, Q, Subquery
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from moderation.visibility import hidden_profiles, private_profiles, viewer_profile
from notifications.models import Kind
from notifications.services import attendees_of, notify
from profiles.models import Follow, Profile
from profiles.permissions import CanActAsOwner
from profiles.serializers import ProfileSummarySerializer
from students.services import current_university

from . import attendance as rsvps
from . import geocoding
from .models import Attendance, Category, CoHost, Event, EventFeedback, SavedEvent
from .serializers import (
    AttendanceSummarySerializer,
    CategorySerializer,
    EventSerializer,
    GeocodeResultSerializer,
    ProfileStatsSerializer,
    RsvpSerializer,
    attendance_summary,
)
from .services import feedback_open
from .stats import count_view, profile_stats


class AttendeesQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[Attendance.Status.GOING, Attendance.Status.INTERESTED],
        default=Attendance.Status.GOING,
    )


class AttendeesPagination(LimitOffsetPagination):
    default_limit = 30
    max_limit = 100


class AnnouncementSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=500)


class AnnouncementSentSerializer(serializers.Serializer):
    sent = serializers.IntegerField(help_text="How many people were notified.")


class FeedbackSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class MyFeedbackSerializer(serializers.Serializer):
    can_give = serializers.BooleanField(
        help_text="Whether you can rate the event: you were going and it has ended."
    )
    rating = serializers.IntegerField(allow_null=True)
    comment = serializers.CharField(allow_blank=True)


class FeedbackCommentSerializer(serializers.Serializer):
    rating = serializers.IntegerField()
    comment = serializers.CharField()
    created_at = serializers.DateTimeField()


class FeedbackSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    average = serializers.FloatField(allow_null=True)
    ratings = serializers.ListField(
        child=serializers.IntegerField(), help_text="How many rated it 1, 2, 3, 4 and 5."
    )
    comments = FeedbackCommentSerializer(many=True, help_text="Newest first, without names.")


def require_host(user, event):
    """Organizer tools are for people acting for the organizer or an accepted co-host."""
    hosts = [
        event.organizer_id,
        *event.co_host_links.filter(accepted_at__isnull=False).values_list("profile", flat=True),
    ]
    if not Profile.objects.manageable_by(user).filter(pk__in=hosts).exists():
        raise PermissionDenied()


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
        if event.students_of_id and request.method == "PUT":
            if current_university(request.user) != event.students_of:
                raise ValidationError(
                    _(
                        "This event is for %(university)s students. "
                        "Verify you study there in Settings."
                    )
                    % {"university": event.students_of.short_name}
                )
        if event.min_age and request.method == "PUT":
            age = request.user.age
            if age is None:
                raise ValidationError(_("Add your birth date in Settings to join this event."))
            if age < event.min_age:
                raise ValidationError(
                    _("This event is for people aged %(age)s or over.") % {"age": event.min_age}
                )
        if request.method == "PUT":
            serializer = RsvpSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            rsvps.rsvp(event, profile, serializer.validated_data["status"])
        else:
            rsvps.cancel(event, profile)
        event = self.get_queryset().get(pk=pk)
        return Response(attendance_summary(event, profile, self.get_serializer_context()))

    @extend_schema(
        parameters=[AttendeesQuerySerializer], responses=ProfileSummarySerializer(many=True)
    )
    @action(detail=True, methods=["get"], pagination_class=AttendeesPagination)
    def attendees(self, request, pk=None):
        """Who's going (or interested): people you follow first, then the latest RSVPs.

        Leaves out people who hide their attendance (except yourself), blocked
        profiles and private profiles you don't follow.
        """
        event = get_object_or_404(Event.objects.visible_to(viewer_profile(request)), pk=pk)
        params = AttendeesQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        viewer = viewer_profile(request)
        rsvps_of = Attendance.objects.filter(event=event, status=params.validated_data["status"])
        profiles = (
            Profile.objects.filter(pk__in=rsvps_of.values("profile"), removed_at__isnull=True)
            .exclude(pk__in=hidden_profiles(viewer))
            .exclude(pk__in=private_profiles(viewer))
            .annotate(
                rsvp_at=Subquery(rsvps_of.filter(profile=OuterRef("pk")).values("updated_at")[:1]),
                followed=Exists(Follow.objects.filter(follower=viewer, followee=OuterRef("pk"))),
            )
            .select_related("avatar")
            .order_by("-followed", "-rsvp_at", "pk")
        )
        shares = Q(hide_attendance=False)
        profiles = profiles.filter(shares | Q(pk=viewer.pk) if viewer else shares)
        page = self.paginate_queryset(profiles)
        context = self.get_serializer_context()
        return self.get_paginated_response(
            ProfileSummarySerializer(page, many=True, context=context).data
        )

    @extend_schema(request=None, responses={204: None}, methods=["PUT", "DELETE"])
    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="rsvps",
        http_method_names=["put", "delete", "options"],
    )
    def save(self, request, pk=None):
        """Save the event for later (PUT), or forget it (DELETE). Only you see what you saved."""
        event = get_object_or_404(Event.objects.visible_to(request.user.profile), pk=pk)
        if request.method == "PUT":
            SavedEvent.objects.get_or_create(profile=request.user.profile, event=event)
        else:
            SavedEvent.objects.filter(profile=request.user.profile, event=event).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=AnnouncementSerializer, responses=AnnouncementSentSerializer)
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="announcements",
    )
    def announcements(self, request, pk=None):
        """Send a message to everyone going, interested or waitlisted (hosts only)."""
        event = get_object_or_404(self.get_queryset(), pk=pk)
        require_host(request.user, event)
        serializer = AnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipients = list(attendees_of(event))
        notify(
            recipients,
            Kind.ANNOUNCEMENT,
            actor=event.organizer,
            event=event,
            message=serializer.validated_data["message"],
        )
        return Response({"sent": len(recipients)})

    @extend_schema(request=None, responses={204: None})
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.AllowAny],
        throttle_scope="views",
    )
    def view(self, request, pk=None):
        """Count that someone opened the event's page (for its hosts' dashboard)."""
        event = get_object_or_404(Event.objects.visible_to(viewer_profile(request)), pk=pk)
        count_view(event, viewer_profile(request))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses=MyFeedbackSerializer, methods=["GET"])
    @extend_schema(request=FeedbackSerializer, responses=MyFeedbackSerializer, methods=["PUT"])
    @action(
        detail=True,
        methods=["get", "put"],
        url_path="feedback/mine",
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="rsvps",
        http_method_names=["get", "put", "options"],
    )
    def my_feedback(self, request, pk=None):
        """Your rating of the event (GET), or give or change it (PUT) once it has ended."""
        event = get_object_or_404(self.get_queryset(), pk=pk)
        profile = request.user.profile
        went = Attendance.objects.filter(
            event=event, profile=profile, status=Attendance.Status.GOING
        ).exists()
        can_give = went and feedback_open(event)
        if request.method == "PUT":
            if not can_give:
                raise ValidationError(_("Only people who went can rate an event, after it ends."))
            serializer = FeedbackSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            EventFeedback.objects.update_or_create(
                event=event, profile=profile, defaults=serializer.validated_data
            )
        mine = EventFeedback.objects.filter(event=event, profile=profile).first()
        return Response(
            {
                "can_give": can_give,
                "rating": mine.rating if mine else None,
                "comment": mine.comment if mine else "",
            }
        )

    @extend_schema(responses=FeedbackSummarySerializer)
    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def feedback(self, request, pk=None):
        """Ratings and comments from people who went, without names (hosts only)."""
        event = get_object_or_404(self.get_queryset(), pk=pk)
        require_host(request.user, event)
        rows = EventFeedback.objects.filter(event=event)
        counts = dict(rows.values_list("rating").annotate(count=Count("pk")).order_by())
        comments = rows.exclude(comment="").order_by("-created_at")[:100]
        return Response(
            {
                "count": sum(counts.values()),
                "average": rows.aggregate(average=Avg("rating"))["average"],
                "ratings": [counts.get(rating, 0) for rating in range(1, 6)],
                "comments": FeedbackCommentSerializer(comments, many=True).data,
            }
        )

    @extend_schema(
        responses={(200, "text/csv"): OpenApiResponse(OpenApiTypes.STR, description="CSV file")}
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="attendees/export",
        permission_classes=[permissions.IsAuthenticated],
    )
    def export_attendees(self, request, pk=None):
        """Everyone who answered, as CSV (hosts only). Includes people who hide their attendance."""
        event = get_object_or_404(self.get_queryset(), pk=pk)
        require_host(request.user, event)
        rows = (
            Attendance.objects.filter(event=event)
            .select_related("profile")
            .order_by("status", "created_at")
        )
        buffer = io.StringIO()
        # A byte order mark, so Excel reads the file as UTF-8 (ä, ö, å).
        buffer.write("\ufeff")
        writer = csv.writer(buffer)
        writer.writerow([_("Name"), _("Username"), _("Status"), _("Answered at")])
        for row in rows:
            writer.writerow(
                [
                    row.profile.display_name,
                    row.profile.handle,
                    row.get_status_display(),
                    timezone.localtime(row.created_at).strftime("%Y-%m-%d %H:%M"),
                ]
            )
        response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="event-{event.pk}-attendees.csv"'
        return response


class ProfileStatsView(APIView):
    """Views, RSVPs and follower growth for a profile you act for, over the last 30 days."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=ProfileStatsSerializer)
    def get(self, request, handle):
        profile = get_object_or_404(Profile.objects.manageable_by(request.user), handle=handle)
        return Response(ProfileStatsSerializer(profile_stats(profile)).data)


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


class MyEventsPagination(LimitOffsetPagination):
    default_limit = 30
    max_limit = 100


class MyEventListView(generics.ListAPIView):
    """Base for the signed-in user's own lists: upcoming (soonest first) or past (latest first)."""

    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = MyEventsPagination

    @extend_schema(
        parameters=[OpenApiParameter("when", enum=["upcoming", "past"], default="upcoming")]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def events_of(self, viewer):
        raise NotImplementedError

    def get_queryset(self):
        viewer = self.request.user.profile
        events = self.events_of(viewer).for_display(viewer)
        now = timezone.now()
        if self.request.query_params.get("when") == "past":
            return events.filter(ends_at__lt=now).order_by("-starts_at", "-id")
        return events.filter(ends_at__gte=now).order_by("starts_at", "id")


class ManagedEventsView(MyEventListView):
    """Events organized by the signed-in user or their organizations, drafts included."""

    def events_of(self, viewer):
        return Event.objects.filter(organizer__in=Profile.objects.manageable_by(viewer.user))


class AttendingEventsView(MyEventListView):
    """Events the signed-in user is going to, interested in or waitlisted for."""

    def events_of(self, viewer):
        answered = Attendance.objects.filter(profile=viewer).values("event")
        return Event.objects.visible_to(viewer).filter(pk__in=answered)


class SavedEventsView(MyEventListView):
    """Events the signed-in user saved."""

    def events_of(self, viewer):
        saved = SavedEvent.objects.filter(profile=viewer).values("event")
        return Event.objects.visible_to(viewer).filter(pk__in=saved)
