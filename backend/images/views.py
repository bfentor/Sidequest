from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser

from .serializers import ImageUploadSerializer


class ImageUploadView(generics.CreateAPIView):
    """Upload a picture, to attach to a profile, event or post by its id."""

    serializer_class = ImageUploadSerializer
    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]
