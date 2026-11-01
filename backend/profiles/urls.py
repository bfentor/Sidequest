from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import MeView, ProfileViewSet

router = SimpleRouter()
router.register("profiles", ProfileViewSet, basename="profile")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    *router.urls,
]
