from django.urls import path

from .views import (
    AccountSettingsView,
    DigestUnsubscribeView,
    MarkReadView,
    NotificationListView,
    PushDeviceDetailView,
    PushDeviceView,
    UnreadCountView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/unread/", UnreadCountView.as_view(), name="notification-unread"),
    path("notifications/read/", MarkReadView.as_view(), name="notification-read"),
    path("push-devices/", PushDeviceView.as_view(), name="push-device"),
    path("push-devices/<str:token>/", PushDeviceDetailView.as_view(), name="push-device-detail"),
    path("me/settings/", AccountSettingsView.as_view(), name="me-settings"),
    path(
        "digest/unsubscribe/<str:token>/",
        DigestUnsubscribeView.as_view(),
        name="digest-unsubscribe",
    ),
]
