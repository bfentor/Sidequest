from rest_framework import mixins, permissions, viewsets

from moderation.visibility import viewer_profile
from profiles.permissions import CanActAsOwner

from .models import Post
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
