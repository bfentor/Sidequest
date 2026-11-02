from rest_framework import generics, mixins, permissions, viewsets

from moderation.visibility import viewer_profile
from profiles.permissions import CanActAsOwner

from .models import Category, Event
from .serializers import CategorySerializer, EventSerializer


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
        return (
            Event.objects.visible_to(viewer_profile(self.request))
            .select_related("organizer__avatar")
            .prefetch_related("categories")
        )


class CategoryListView(generics.ListAPIView):
    """Every category, in display order, named in the request's language."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
