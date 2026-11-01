from rest_framework.routers import SimpleRouter

from .views import PostViewSet

router = SimpleRouter()
router.register("posts", PostViewSet, basename="post")

urlpatterns = router.urls
