from django.db import models

from events.models import Event
from profiles.models import Follow, Profile


class PostQuerySet(models.QuerySet):
    def following_feed_for(self, profile):
        """Posts by `profile` and by every profile it follows."""
        followed = Follow.objects.filter(follower=profile).values("followee")
        return self.filter(models.Q(author__in=followed) | models.Q(author=profile))


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
