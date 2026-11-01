from django.urls import path

from .views import FollowingFeedView, NearbyFeedView, UpcomingFeedView

urlpatterns = [
    path("upcoming/", UpcomingFeedView.as_view(), name="feed-upcoming"),
    path("nearby/", NearbyFeedView.as_view(), name="feed-nearby"),
    path("following/", FollowingFeedView.as_view(), name="feed-following"),
]
