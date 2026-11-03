from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AttendingEventsView,
    CalendarSourcesView,
    CalendarSourceView,
    CategoryListView,
    CoHostAnswerView,
    CoHostInvitationsView,
    EventViewSet,
    GeocodeView,
    ManagedEventsView,
    ProfileStatsView,
    SavedEventsView,
)

router = SimpleRouter()
router.register("events", EventViewSet, basename="event")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("me/events/", ManagedEventsView.as_view(), name="managed-events"),
    path("me/attending/", AttendingEventsView.as_view(), name="attending-events"),
    path("me/saved/", SavedEventsView.as_view(), name="saved-events"),
    path("profiles/<str:handle>/stats/", ProfileStatsView.as_view(), name="profile-stats"),
    path(
        "profiles/<str:handle>/calendars/",
        CalendarSourcesView.as_view(),
        name="calendar-sources",
    ),
    path(
        "profiles/<str:handle>/calendars/<int:pk>/",
        CalendarSourceView.as_view(),
        name="calendar-source",
    ),
    path("events/<int:pk>/co-host/", CoHostInvitationsView.as_view(), name="event-co-host"),
    path(
        "events/<int:pk>/co-host/<str:handle>/",
        CoHostAnswerView.as_view(),
        name="event-co-host-answer",
    ),
    *router.urls,
]
