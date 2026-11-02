from django.urls import path

from .views import BlockedProfilesView, BlockView, MutedProfilesView, MuteView, ReportCreateView

urlpatterns = [
    path("reports/", ReportCreateView.as_view(), name="report-create"),
    path("profiles/<str:handle>/block/", BlockView.as_view(), name="profile-block"),
    path("profiles/<str:handle>/mute/", MuteView.as_view(), name="profile-mute"),
    path("me/blocked/", BlockedProfilesView.as_view(), name="me-blocked"),
    path("me/muted/", MutedProfilesView.as_view(), name="me-muted"),
]
