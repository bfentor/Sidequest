from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from moderation.models import Block
from moderation.visibility import viewer_profile

from .models import Follow, Profile
from .serializers import ProfileSerializer


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
            Follow.objects.get_or_create(follower=follower, followee=followee)
        else:
            Follow.objects.filter(follower=follower, followee=followee).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
