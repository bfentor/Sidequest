from django.db import models
from django.utils import timezone

from config.db import count_of
from events.models import Event
from moderation.visibility import hidden_profiles, muted_profiles, private_profiles
from profiles.models import Follow, Profile


class PostQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Not removed, by a visible author, and sharing no event the viewer may not see."""
        return (
            self.filter(removed_at__isnull=True, author__removed_at__isnull=True)
            .exclude(author__in=hidden_profiles(viewer))
            .exclude(author__in=private_profiles(viewer))
            .filter(
                models.Q(event__isnull=True)
                | models.Q(event__in=Event.objects.visible_to(viewer).values("pk"))
            )
        )

    def for_display(self, viewer):
        """Everything a post's serializer shows; shared events come with their attendance."""
        likes = PostLike.objects.filter(post=models.OuterRef("pk"))
        liked = (
            models.Exists(likes.filter(profile=viewer))
            if viewer is not None
            else models.Value(False)
        )
        return (
            self.select_related("author__avatar")
            .prefetch_related(
                models.Prefetch("event", queryset=Event.objects.for_display(viewer)),
                "image_links__image",
            )
            .annotate(
                like_count=count_of(likes),
                is_liked=liked,
                comment_count=count_of(
                    Comment.objects.visible_to(viewer).filter(post=models.OuterRef("pk"))
                ),
            )
        )

    def in_feeds_of(self, viewer):
        """Like visible_to, also leaving out profiles the viewer muted."""
        return self.visible_to(viewer).exclude(author__in=muted_profiles(viewer))

    def following_feed_for(self, profile):
        """Posts by `profile` and by every profile it follows."""
        followed = Follow.objects.filter(follower=profile).values("followee")
        return self.filter(models.Q(author__in=followed) | models.Q(author=profile))

    def latest_per_event(self):
        """Leaves out posts whose event a newer post in this queryset also shares.

        Each event then shows once, where it was last posted.
        """
        newer = self.filter(
            event=models.OuterRef("event"), created_at__gt=models.OuterRef("created_at")
        )
        return self.exclude(models.Q(event__isnull=False) & models.Exists(newer))

    def without_past_events(self):
        """Leaves out posts sharing an event that has ended; text-only posts stay."""
        return self.exclude(event__ends_at__lt=timezone.now())


class Post(models.Model):
    """An entry in the following feed: text, pictures, an event, or a mix.

    Publishing an event creates a post linking to it, so events reach
    followers through the same feed as everything else. That a post isn't
    empty is checked by its serializer, since pictures live in PostImage.
    """

    author = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="posts")
    body = models.TextField(max_length=2000, blank=True)
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, null=True, blank=True, related_name="posts"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # When the author last changed the text or pictures.
    edited_at = models.DateTimeField(null=True, blank=True)
    # Set by moderators; hides the post everywhere.
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = PostQuerySet.as_manager()

    class Meta:
        indexes = [models.Index(fields=["author", "-created_at"])]

    def __str__(self):
        return f"Post by {self.author} at {self.created_at:%Y-%m-%d %H:%M}"


class PostImage(models.Model):
    """A picture in a post, in the order the author chose."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="image_links")
    image = models.ForeignKey("images.Image", on_delete=models.CASCADE, related_name="post_links")
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["post", "image"], name="unique_post_image"),
        ]

    def __str__(self):
        return f"Picture {self.position + 1} of {self.post}"


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["post", "profile"], name="unique_post_like"),
        ]

    def __str__(self):
        return f"{self.profile} likes {self.post}"


class CommentQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Not removed, by an author the viewer may see, on a post or event they may see."""
        return (
            self.filter(removed_at__isnull=True, author__removed_at__isnull=True)
            .exclude(author__in=hidden_profiles(viewer))
            .exclude(author__in=private_profiles(viewer))
            .filter(
                models.Q(post__in=Post.objects.visible_to(viewer).values("pk"))
                | models.Q(event__in=Event.objects.visible_to(viewer).values("pk"))
            )
        )


class Comment(models.Model):
    """A comment on a post, or a question or comment on an event."""

    author = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="comments")
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, null=True, blank=True, related_name="comments"
    )
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, null=True, blank=True, related_name="comments"
    )
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    # Set by moderators; hides the comment everywhere.
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = CommentQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["post", "created_at"]),
            models.Index(fields=["event", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(post__isnull=False, event__isnull=True)
                | models.Q(post__isnull=True, event__isnull=False),
                name="comment_on_post_or_event",
            ),
        ]

    def __str__(self):
        return f"Comment by {self.author} on {self.post or self.event}"

    @property
    def owner(self):
        """Whose post or event this comment is on; they may delete it."""
        return self.post.author if self.post_id else self.event.organizer
