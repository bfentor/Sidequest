from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from profiles.models import Profile
from profiles.serializers import ProfileSummarySerializer

from . import services
from .models import Mute
from .serializers import ReportSerializer
from .visibility import viewer_profile


class ReportCreateView(generics.CreateAPIView):
    """Report a post, event or profile to the moderators."""

    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "reports"


class _ProfileRelationView(APIView):
    """POST to start blocking/muting a profile, DELETE to stop."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "blocks"

    def target(self, request, handle):
        target = get_object_or_404(
            Profile.objects.visible_to(viewer_profile(request)), handle=handle
        )
        if target == request.user.profile:
            raise ValidationError(self.self_error)
        return target


class BlockView(_ProfileRelationView):
    self_error = _("You cannot block yourself.")

    @extend_schema(request=None, responses={204: None})
    def post(self, request, handle):
        services.block(request.user.profile, self.target(request, handle))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, handle):
        target = get_object_or_404(Profile, handle=handle)
        request.user.profile.blocks.filter(blocked=target).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MuteView(_ProfileRelationView):
    self_error = _("You cannot mute yourself.")

    @extend_schema(request=None, responses={204: None})
    def post(self, request, handle):
        Mute.objects.get_or_create(muter=request.user.profile, muted=self.target(request, handle))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, handle):
        target = get_object_or_404(Profile, handle=handle)
        request.user.profile.mutes.filter(muted=target).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlockedProfilesView(generics.ListAPIView):
    """Profiles the signed-in user has blocked."""

    serializer_class = ProfileSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Profile.objects.filter(blocked_by__blocker=self.request.user.profile).select_related(
            "avatar"
        )


class MutedProfilesView(generics.ListAPIView):
    """Profiles the signed-in user has muted."""

    serializer_class = ProfileSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Profile.objects.filter(muted_by__muter=self.request.user.profile).select_related(
            "avatar"
        )
