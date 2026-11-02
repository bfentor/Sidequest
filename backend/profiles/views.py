from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination, LimitOffsetPagination
from rest_framework.response import Response

from events.models import Event
from events.serializers import EventSerializer
from moderation.models import Block
from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import notify
from posts.models import Post
from posts.serializers import PostSerializer

from .models import Follow, Profile
from .serializers import ProfileSerializer, ProfileSummarySerializer


class ProfileListPagination(CursorPagination):
    ordering = ("-created_at", "-id")
    page_size = 30


class ProfileEventsPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 50


class ProfileViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ProfileSerializer
    lookup_field = "handle"
    throttle_scope = "follows"

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return (
            Profile.objects.visible_to(viewer)
            .with_social_stats(viewer=viewer)
            .select_related("avatar")
            .prefetch_related("interests")
        )

    @extend_schema(request=None, responses={204: None})
    @action(
        detail=True, methods=["post", "delete"], permission_classes=[permissions.IsAuthenticated]
    )
    def follow(self, request, handle=None):
        follower = request.user.profile
        followee = get_object_or_404(Profile.objects.visible_to(follower), handle=handle)
        if request.method == "POST":
            if followee == follower:
                raise ValidationError(_("You cannot follow yourself."))
            if Block.objects.filter(blocker=follower, blocked=followee).exists():
                raise ValidationError(_("Unblock this profile to follow it."))
            follow, created = Follow.objects.get_or_create(follower=follower, followee=followee)
            if created:
                notify([followee], Kind.NEW_FOLLOWER, actor=follower)
        else:
            Follow.objects.filter(follower=follower, followee=followee).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _profile(self, handle):
        return get_object_or_404(
            Profile.objects.visible_to(viewer_profile(self.request)), handle=handle
        )

    def _page(self, queryset, serializer_class, pagination_class):
        paginator = pagination_class()
        page = paginator.paginate_queryset(queryset, self.request, view=self)
        context = self.get_serializer_context()
        return paginator.get_paginated_response(
            serializer_class(page, many=True, context=context).data
        )

    @extend_schema(responses=ProfileSummarySerializer(many=True))
    @action(detail=True, pagination_class=ProfileListPagination)
    def followers(self, request, handle=None):
        """Profiles following this one, most recent first."""
        profile = self._profile(handle)
        follows = Follow.objects.filter(
            followee=profile, follower__in=Profile.objects.visible_to(viewer_profile(request))
        ).select_related("follower__avatar")
        return self._follow_page(follows, "follower")

    @extend_schema(responses=ProfileSummarySerializer(many=True))
    @action(detail=True, pagination_class=ProfileListPagination)
    def following(self, request, handle=None):
        """Profiles this one follows, most recent first."""
        profile = self._profile(handle)
        follows = Follow.objects.filter(
            follower=profile, followee__in=Profile.objects.visible_to(viewer_profile(request))
        ).select_related("followee__avatar")
        return self._follow_page(follows, "followee")

    def _follow_page(self, follows, side):
        paginator = ProfileListPagination()
        page = paginator.paginate_queryset(follows, self.request, view=self)
        profiles = [getattr(follow, side) for follow in page]
        context = self.get_serializer_context()
        data = ProfileSummarySerializer(profiles, many=True, context=context).data
        return paginator.get_paginated_response(data)

    @extend_schema(responses=PostSerializer(many=True))
    @action(detail=True, pagination_class=ProfileListPagination)
    def posts(self, request, handle=None):
        """This profile's posts, newest first."""
        profile = self._profile(handle)
        posts = (
            Post.objects.visible_to(viewer_profile(request))
            .filter(author=profile)
            .select_related("author__avatar", "event__organizer__avatar")
            .prefetch_related("event__categories")
        )
        return self._page(posts, PostSerializer, ProfileListPagination)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "when", enum=["upcoming", "past"], default="upcoming", description="Which events."
            )
        ],
        responses=EventSerializer(many=True),
    )
    @action(detail=True, pagination_class=ProfileEventsPagination)
    def events(self, request, handle=None):
        """Events this profile organizes: upcoming soonest first, or past newest first."""
        profile = self._profile(handle)
        when = request.query_params.get("when", "upcoming")
        if when not in ("upcoming", "past"):
            raise serializers.ValidationError({"when": _("Use upcoming or past.")})
        viewer = viewer_profile(request)
        events = (
            Event.objects.visible_to(viewer)
            .filter(organizer=profile)
            .with_attendance(viewer)
            .select_related("organizer__avatar")
            .prefetch_related("categories")
        )
        now = timezone.now()
        events = (
            events.filter(ends_at__gte=now).order_by("starts_at", "id")
            if when == "upcoming"
            else events.filter(ends_at__lt=now).order_by("-starts_at", "-id")
        )
        return self._page(events, EventSerializer, ProfileEventsPagination)


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user's own profile."""

    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "options"]

    def get_object(self):
        return (
            Profile.objects.with_social_stats(viewer=self.request.user.profile)
            .select_related("avatar")
            .prefetch_related("interests")
            .get(user=self.request.user)
        )
