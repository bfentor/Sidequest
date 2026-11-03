from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Flag


class FlagsView(APIView):
    """Which feature flags are on for you, as {"name": true}. Flags left out are off."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: {"type": "object", "additionalProperties": {"type": "boolean"}}},
    )
    def get(self, request):
        on = [
            flag.name
            for flag in Flag.objects.prefetch_related("testers")
            if flag.is_on_for(request.user)
        ]
        return Response({name: True for name in on})
