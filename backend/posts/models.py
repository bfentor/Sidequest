from django.db import models
from django.utils import timezone

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
        return self.select_related("author__avatar").prefetch_related(
            models.Prefetch("event", queryset=Event.objects.for_display(viewer))
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
    """An entry in the following feed: a text update, an event, or both.

    Publishing an event creates a post linking to it, so events reach
    followers through the same feed as everything else.
    """

    author = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="posts")
    body = models.TextField(max_length=2000, blank=True)
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, null=True, blank=True, related_name="posts"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Set by moderators; hides the post everywhere.
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = PostQuerySet.as_manager()

    class Meta:
        indexes = [models.Index(fields=["author", "-created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(body="") | models.Q(event__isnull=False),
                name="post_has_body_or_event",
            ),
        ]

    def __str__(self):
        return f"Post by {self.author} at {self.created_at:%Y-%m-%d %H:%M}"
