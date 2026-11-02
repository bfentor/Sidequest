from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import FollowRequestListView, FollowRequestView, MeView, ProfileViewSet

router = SimpleRouter()
router.register("profiles", ProfileViewSet, basename="profile")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/follow-requests/", FollowRequestListView.as_view(), name="follow-request-list"),
    path("me/follow-requests/<str:handle>/", FollowRequestView.as_view(), name="follow-request"),
    *router.urls,
]
