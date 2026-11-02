from django.urls import path
from rest_framework.routers import SimpleRouter

from .organizations import (
    ActingProfilesView,
    MemberView,
    MyInvitationsView,
    MyInvitationView,
    OrganizationViewSet,
)
from .views import FollowRequestListView, FollowRequestView, MeView, ProfileViewSet

router = SimpleRouter()
router.register("profiles", ProfileViewSet, basename="profile")
router.register("organizations", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/follow-requests/", FollowRequestListView.as_view(), name="follow-request-list"),
    path("me/follow-requests/<str:handle>/", FollowRequestView.as_view(), name="follow-request"),
    path("me/profiles/", ActingProfilesView.as_view(), name="acting-profiles"),
    path("me/invitations/", MyInvitationsView.as_view(), name="my-invitations"),
    path("me/invitations/<int:pk>/", MyInvitationView.as_view(), name="my-invitation"),
    path(
        "organizations/<str:handle>/members/<str:member>/",
        MemberView.as_view(),
        name="organization-member",
    ),
    *router.urls,
]
