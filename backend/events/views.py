from rest_framework import mixins, permissions, viewsets

from moderation.visibility import viewer_profile
from profiles.permissions import CanActAsOwner

from .models import Event
from .serializers import EventSerializer


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
    http_method_names = ["get", "post", "patch", "delete", "options"]

    def get_queryset(self):
        return Event.objects.visible_to(viewer_profile(self.request)).select_related(
            "organizer__avatar"
        )
