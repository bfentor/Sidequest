from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CategoryListView, EventViewSet, GeocodeView, ManagedEventsView

router = SimpleRouter()
router.register("events", EventViewSet, basename="event")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("me/events/", ManagedEventsView.as_view(), name="managed-events"),
    *router.urls,
]
