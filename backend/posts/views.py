from rest_framework import mixins, permissions, viewsets

from moderation.visibility import viewer_profile
from profiles.permissions import CanActAsOwner

from .models import Post
from .serializers import PostSerializer


class PostViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Create, view and delete single posts. Listing happens through the feeds."""

    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanActAsOwner]
    owner_field = "author"

    def get_queryset(self):
        return Post.objects.visible_to(viewer_profile(self.request)).select_related(
            "author__avatar", "event__organizer__avatar"
        )
