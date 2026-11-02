from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Follow, Profile
from .serializers import ProfileSerializer


class ProfileViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ProfileSerializer
    lookup_field = "handle"

    def get_queryset(self):
        return Profile.objects.with_social_stats(viewer=self.request.user)

    @extend_schema(request=None, responses={204: None})
    @action(
        detail=True, methods=["post", "delete"], permission_classes=[permissions.IsAuthenticated]
    )
    def follow(self, request, handle=None):
        followee = get_object_or_404(Profile, handle=handle)
        follower = request.user.profile
        if request.method == "POST":
            if followee == follower:
                raise ValidationError(_("You cannot follow yourself."))
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
        return Profile.objects.with_social_stats(viewer=self.request.user).get(
            user=self.request.user
        )
