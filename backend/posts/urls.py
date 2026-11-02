from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CommentView, EventCommentsView, PostCommentsView, PostViewSet

router = SimpleRouter()
router.register("posts", PostViewSet, basename="post")

urlpatterns = [
    path("posts/<int:pk>/comments/", PostCommentsView.as_view(), name="post-comments"),
    path("events/<int:pk>/comments/", EventCommentsView.as_view(), name="event-comments"),
    path("comments/<int:pk>/", CommentView.as_view(), name="comment"),
    *router.urls,
]
