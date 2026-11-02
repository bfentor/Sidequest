from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import CursorPagination, LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from events.models import Event
from events.serializers import EventSerializer
from moderation.models import Block
from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import notify
from posts.models import Post
from posts.serializers import PostSerializer

from .models import Follow, FollowRequest, Profile
from .serializers import FollowStatusSerializer, ProfileSerializer, ProfileSummarySerializer
from .suggestions import follow_suggestions


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

    @extend_schema(request=None, responses=FollowStatusSerializer)
    @action(
        detail=True, methods=["post", "delete"], permission_classes=[permissions.IsAuthenticated]
    )
    def follow(self, request, handle=None):
        """Follow (POST) or unfollow (DELETE). Private profiles get a follow request instead."""
        follower = request.user.profile
        followee = get_object_or_404(Profile.objects.visible_to(follower), handle=handle)
        if request.method == "DELETE":
            Follow.objects.filter(follower=follower, followee=followee).delete()
            FollowRequest.objects.filter(requester=follower, target=followee).delete()
            return Response({"status": "none"})

        if followee == follower:
            raise ValidationError(_("You cannot follow yourself."))
        if Block.objects.filter(blocker=follower, blocked=followee).exists():
            raise ValidationError(_("Unblock this profile to follow it."))
        if Follow.objects.filter(follower=follower, followee=followee).exists():
            return Response({"status": "following"})
        if followee.is_private:
            _request, created = FollowRequest.objects.get_or_create(
                requester=follower, target=followee
            )
            if created:
                notify([followee], Kind.FOLLOW_REQUEST, actor=follower)
            return Response({"status": "requested"})
        Follow.objects.create(follower=follower, followee=followee)
        notify([followee], Kind.NEW_FOLLOWER, actor=follower)
        return Response({"status": "following"})

    def _lists_hidden(self, profile):
        viewer = viewer_profile(self.request)
        if viewer == profile:
            return False
        return (
            profile.hide_followers
            or Profile.objects.private_to(viewer).filter(pk=profile.pk).exists()
        )

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
        if self._lists_hidden(profile):
            raise PermissionDenied(_("This profile's followers are hidden."))
        follows = Follow.objects.filter(
            followee=profile, follower__in=Profile.objects.visible_to(viewer_profile(request))
        ).select_related("follower__avatar")
        return self._follow_page(follows, "follower")

    @extend_schema(responses=ProfileSummarySerializer(many=True))
    @action(detail=True, pagination_class=ProfileListPagination)
    def following(self, request, handle=None):
        """Profiles this one follows, most recent first."""
        profile = self._profile(handle)
        if self._lists_hidden(profile):
            raise PermissionDenied(_("This profile's followers are hidden."))
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
            .for_display(viewer_profile(request))
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
        hosted = models.Q(organizer=profile) | models.Q(
            co_host_links__profile=profile, co_host_links__accepted_at__isnull=False
        )
        events = (
            Event.objects.visible_to(viewer)
            .filter(published_at__lte=timezone.now())
            .filter(hosted)
            .distinct()
            .for_display(viewer)
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

    def perform_update(self, serializer):
        was_private = serializer.instance.is_private
        profile = serializer.save()
        if was_private and not profile.is_private:
            for follow_request in profile.follow_requests.select_related("requester"):
                accept_follow_request(follow_request)

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


def accept_follow_request(follow_request):
    Follow.objects.get_or_create(follower=follow_request.requester, followee=follow_request.target)
    follow_request.delete()
    notify([follow_request.requester], Kind.FOLLOW_ACCEPTED, actor=follow_request.target)


class FollowRequestListView(generics.ListAPIView):
    """People asking to follow the signed-in user's private profile, newest first."""

    serializer_class = ProfileSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ProfileListPagination

    def get_queryset(self):
        return Profile.objects.filter(
            sent_requests__target=self.request.user.profile
        ).select_related("avatar")


class FollowRequestView(APIView):
    """Accept (POST) or decline (DELETE) someone's request to follow you."""

    permission_classes = [permissions.IsAuthenticated]

    def _request(self, request, handle):
        return get_object_or_404(
            FollowRequest, target=request.user.profile, requester__handle=handle
        )

    @extend_schema(request=None, responses={204: None})
    def post(self, request, handle):
        accept_follow_request(self._request(request, handle))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, handle):
        self._request(request, handle).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SuggestionsQuerySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(
        choices=Profile.Kind.choices, required=False, help_text="Only people or organizations."
    )


@extend_schema(parameters=[SuggestionsQuerySerializer])
class FollowSuggestionsView(generics.ListAPIView):
    """Up to ten profiles the signed-in user might want to follow."""

    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    limit = 10

    def get_queryset(self):
        params = SuggestionsQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        viewer = self.request.user.profile
        profiles = follow_suggestions(viewer)
        if "kind" in params.validated_data:
            profiles = profiles.filter(kind=params.validated_data["kind"])
        return (
            profiles.with_social_stats(viewer=viewer)
            .select_related("avatar")
            .prefetch_related("interests")[: self.limit]
        )
