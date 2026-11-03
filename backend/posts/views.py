from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import CursorPagination, LimitOffsetPagination
from rest_framework.response import Response

from events.models import Event
from moderation import filters
from moderation.visibility import viewer_profile
from notifications.models import Kind
from notifications.services import managers_of, notify
from profiles.models import Profile
from profiles.permissions import CanActAsOwner

from .links import first_url, preview_for
from .models import Comment, Post, PostImage, PostLike
from .serializers import CommentSerializer, EventPhotoSerializer, PostSerializer
from .text import notify_mentions


class PostViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Create, view, edit and delete single posts. Listing happens through the feeds."""

    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, CanActAsOwner]
    owner_field = "author"
    throttle_scope = "posts"
    http_method_names = ["get", "post", "patch", "delete", "options"]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return Post.objects.visible_to(viewer).for_display(viewer)

    def perform_create(self, serializer):
        post = serializer.save(
            link_preview=preview_for(first_url(serializer.validated_data.get("body")))
        )
        notify_mentions(post.body, author=post.author, post=post)
        filters.flag(post, post.body)

    def perform_update(self, serializer):
        before = serializer.instance.body
        url = first_url(serializer.validated_data.get("body", before))
        # Fetched again only when the first link changed.
        extra = {"link_preview": preview_for(url)} if url != first_url(before) else {}
        post = serializer.save(**extra)
        notify_mentions(post.body, author=post.author, before=before, post=post)
        filters.flag(post, post.body)

    @extend_schema(request=None, responses={204: None}, methods=["PUT", "DELETE"])
    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_scope="likes",
        http_method_names=["put", "delete", "options"],
    )
    def like(self, request, pk=None):
        """Like (PUT) or unlike (DELETE). The author hears about the first like only."""
        profile = request.user.profile
        post = get_object_or_404(Post.objects.visible_to(profile), pk=pk)
        if request.method == "DELETE":
            PostLike.objects.filter(post=post, profile=profile).delete()
        else:
            _like, created = PostLike.objects.get_or_create(post=post, profile=profile)
            if created:
                notify(managers_of(post.author), Kind.REACTION, actor=profile, post=post)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentPagination(CursorPagination):
    ordering = ("created_at", "id")
    page_size = 30


class CommentListView(generics.ListCreateAPIView):
    """Base for the comments on one post or event, oldest first; writing needs sign-in."""

    serializer_class = CommentSerializer
    pagination_class = CommentPagination
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_scope = "comments"
    # The Comment field pointing at the parent, and the parent's owning profile field.
    parent_field: str
    owner_field: str

    def parent(self):
        raise NotImplementedError

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        return (
            Comment.objects.visible_to(viewer)
            .filter(**{self.parent_field: self.parent()})
            .select_related("author__avatar", "post__author", "event__organizer")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        context["managed_profile_ids"] = set(
            Profile.objects.manageable_by(user).values_list("pk", flat=True)
        )
        return context

    def perform_create(self, serializer):
        parent = self.parent()
        comment = serializer.save(**{self.parent_field: parent})
        owner = getattr(parent, self.owner_field)
        notify(
            managers_of(owner),
            Kind.COMMENT,
            actor=comment.author,
            **{self.parent_field: parent},
        )
        notify_mentions(comment.body, author=comment.author, **{self.parent_field: parent})
        filters.flag(comment, comment.body)


class PostCommentsView(CommentListView):
    parent_field = "post"
    owner_field = "author"

    def parent(self):
        viewer = viewer_profile(self.request)
        return get_object_or_404(Post.objects.visible_to(viewer), pk=self.kwargs["pk"])


class EventCommentsView(CommentListView):
    """Questions and comments on an event."""

    parent_field = "event"
    owner_field = "organizer"

    def parent(self):
        viewer = viewer_profile(self.request)
        return get_object_or_404(Event.objects.visible_to(viewer), pk=self.kwargs["pk"])


class EventPhotosPagination(LimitOffsetPagination):
    default_limit = 30
    max_limit = 100


class EventPhotosView(generics.ListAPIView):
    """Pictures from posts sharing an event, newest first: the event's photo gallery.

    Adding a photo is posting it with the event attached, so photos can be
    liked, commented on and reported like any post.
    """

    serializer_class = EventPhotoSerializer
    pagination_class = EventPhotosPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        viewer = viewer_profile(self.request)
        event = get_object_or_404(Event.objects.visible_to(viewer), pk=self.kwargs["pk"])
        posts = Post.objects.visible_to(viewer).filter(event=event)
        return (
            PostImage.objects.filter(post__in=posts)
            .select_related("image", "post__author__avatar")
            .order_by("-post__created_at", "post_id", "position")
        )


class CommentView(generics.DestroyAPIView):
    """Delete a comment you wrote, or one on your post or event."""

    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Comment.objects.visible_to(viewer_profile(self.request)).select_related(
            "post", "event"
        )

    def perform_destroy(self, comment):
        managed = Profile.objects.manageable_by(self.request.user)
        if not managed.filter(pk__in=[comment.author_id, comment.owner.pk]).exists():
            raise PermissionDenied()
        comment.delete()
