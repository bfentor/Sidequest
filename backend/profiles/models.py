from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Count, Exists, OuterRef, Q

handle_validator = RegexValidator(
    r"^[a-z0-9_]+$", "Use only lowercase letters, numbers and underscores."
)


class ProfileQuerySet(models.QuerySet):
    def manageable_by(self, user):
        """Profiles `user` may act as: their own and organizations they belong to."""
        if not user.is_authenticated:
            return self.none()
        return self.filter(Q(user=user) | Q(memberships__user=user)).distinct()

    def with_social_stats(self, viewer):
        """Annotate follower/following counts and whether `viewer` follows each profile."""
        qs = self.annotate(
            follower_count=Count("followed_by", distinct=True),
            following_count=Count("follows", distinct=True),
        )
        if viewer.is_authenticated:
            viewer_follows = Follow.objects.filter(follower__user=viewer, followee=OuterRef("pk"))
            return qs.annotate(is_followed=Exists(viewer_follows))
        return qs.annotate(is_followed=models.Value(False))


class Profile(models.Model):
    """A public identity that can post, organize events and be followed.

    Every user gets a personal profile. Organizations are profiles without a
    user of their own, managed by users through `Membership`. Authorship and
    following always point at a Profile, so people and organizations behave
    the same everywhere.
    """

    class Kind(models.TextChoices):
        PERSON = "person"
        ORGANIZATION = "organization"

    kind = models.CharField(max_length=20, choices=Kind.choices)
    handle = models.CharField(max_length=30, unique=True, validators=[handle_validator])
    display_name = models.CharField(max_length=80)
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="profile",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ProfileQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(kind="person", user__isnull=False) | Q(kind="organization", user__isnull=True)
                ),
                name="profile_user_matches_kind",
            ),
        ]

    def __str__(self):
        return f"@{self.handle}"


class Membership(models.Model):
    """Grants a user the right to act as an organization profile."""

    class Role(models.TextChoices):
        ADMIN = "admin"
        EDITOR = "editor"

    organization = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="memberships",
        limit_choices_to={"kind": Profile.Kind.ORGANIZATION},
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EDITOR)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organization", "user"], name="unique_membership"),
        ]

    def __str__(self):
        return f"{self.user} in {self.organization} ({self.role})"


class Follow(models.Model):
    follower = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="follows")
    followee = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="followed_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "followee"], name="unique_follow"),
            models.CheckConstraint(
                condition=~Q(follower=models.F("followee")), name="no_self_follow"
            ),
        ]

    def __str__(self):
        return f"{self.follower} follows {self.followee}"
