from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import managers_of, notify
from profiles.permissions import CanActAsOwner

from .models import Post, PostLike
from .serializers import PostSerializer


class PostViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Create, view, edit and delete single posts. Listing happens through the feeds."""

    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanActAsOwner]
    owner_field = "author"
    throttle_scope = "posts"
    http_method_names = ["get", "post", "patch", "delete", "options"]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return Post.objects.visible_to(viewer).for_display(viewer)

    @extend_schema(request=None, responses={204: None}, methods=["PUT", "DELETE"])
    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="likes",
        http_method_names=["put", "delete", "options"],
    )
    def like(self, request, pk=None):
        """Like (PUT) or unlike (DELETE). The author hears about the first like only."""
        profile = request.user.profile
        post = get_object_or_404(Post.objects.visible_to(profile), pk=pk)
        if request.method == "DELETE":
            PostLike.objects.filter(post=post, profile=profile).delete()
        else:
            _like, created = PostLike.objects.get_or_create(post=post, profile=profile)
            if created:
                notify(managers_of(post.author), Kind.REACTION, actor=profile, post=post)
        return Response(status=status.HTTP_204_NO_CONTENT)
