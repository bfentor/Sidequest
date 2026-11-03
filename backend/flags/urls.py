from django.urls import path

from .views import FlagsView

urlpatterns = [
    path("flags/", FlagsView.as_view(), name="flags"),
]
