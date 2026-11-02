from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Kind, Notification, PushDevice, PushSetting
from .serializers import (
    AccountSettingsSerializer,
    MarkReadSerializer,
    NotificationSerializer,
    PushDeviceSerializer,
    UnreadCountSerializer,
)


class NewestFirstPagination(CursorPagination):
    ordering = ("-created_at", "-id")
    page_size = 30


class NotificationListView(generics.ListAPIView):
    """The signed-in user's inbox, newest first."""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NewestFirstPagination

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "actor__avatar", "event"
        )


class UnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=UnreadCountSerializer)
    def get(self, request):
        unread = Notification.objects.filter(recipient=request.user, read_at__isnull=True).count()
        return Response({"unread": unread})


class MarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=MarkReadSerializer, responses=UnreadCountSerializer)
    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unread = Notification.objects.filter(recipient=request.user, read_at__isnull=True)
        ids = serializer.validated_data.get("ids")
        (unread.filter(pk__in=ids) if ids is not None else unread).update(read_at=timezone.now())
        return Response({"unread": unread.count()})


class PushDeviceView(APIView):
    """Register this device for push notifications."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PushDeviceSerializer, responses={204: None})
    def post(self, request):
        serializer = PushDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # A token belongs to one phone; whoever signs in on it last gets its pushes.
        PushDevice.objects.update_or_create(
            token=serializer.validated_data["token"], defaults={"user": request.user}
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PushDeviceDetailView(APIView):
    """Stop push notifications to a device, e.g. when signing out on it."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, token):
        get_object_or_404(PushDevice, user=request.user, token=token).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccountSettingsView(APIView):
    """Account-level settings: language and which notifications are pushed."""

    permission_classes = [permissions.IsAuthenticated]

    def _current(self, user):
        disabled = set(
            PushSetting.objects.filter(user=user, enabled=False).values_list("kind", flat=True)
        )
        return {"language": user.language, "push": {k: k not in disabled for k in Kind.values}}

    @extend_schema(responses=AccountSettingsSerializer)
    def get(self, request):
        return Response(self._current(request.user))

    @extend_schema(request=AccountSettingsSerializer, responses=AccountSettingsSerializer)
    def patch(self, request):
        serializer = AccountSettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if "language" in serializer.validated_data:
            user.language = serializer.validated_data["language"]
            user.save(update_fields=["language"])
        for kind, enabled in serializer.validated_data.get("push", {}).items():
            PushSetting.objects.update_or_create(
                user=user, kind=kind, defaults={"enabled": enabled}
            )
        return Response(self._current(user))
