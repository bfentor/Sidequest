from django.urls import path

from .views import (
    FollowingFeedView,
    ForYouFeedView,
    HashtagFeedView,
    NearbyFeedView,
    TrendingFeedView,
    UpcomingFeedView,
)

urlpatterns = [
    path("upcoming/", UpcomingFeedView.as_view(), name="feed-upcoming"),
    path("nearby/", NearbyFeedView.as_view(), name="feed-nearby"),
    path("following/", FollowingFeedView.as_view(), name="feed-following"),
    path("trending/", TrendingFeedView.as_view(), name="feed-trending"),
    path("for-you/", ForYouFeedView.as_view(), name="feed-for-you"),
    path("hashtag/<str:tag>/", HashtagFeedView.as_view(), name="feed-hashtag"),
]
