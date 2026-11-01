from rest_framework import mixins, permissions, viewsets

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

    queryset = Post.objects.select_related("author", "event__organizer")
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanActAsOwner]
    owner_field = "author"
