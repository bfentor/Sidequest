from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CategoryListView, EventViewSet

router = SimpleRouter()
router.register("events", EventViewSet, basename="event")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    *router.urls,
]
