from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Count, Exists, OuterRef, Q
from django.utils.translation import gettext_lazy as _

handle_validator = RegexValidator(
    r"^[a-z0-9_]+$", _("Use only lowercase letters, numbers and underscores.")
)
instagram_validator = RegexValidator(
    r"^[A-Za-z0-9_.]{1,30}$", _("Enter an Instagram username without the @.")
)


class ProfileQuerySet(models.QuerySet):
    def visible_to(self, viewer):
        """Profiles the viewer may see: not removed, and not ones that blocked the viewer."""
        queryset = self.filter(removed_at__isnull=True)
        if viewer is not None:
            queryset = queryset.exclude(blocks__blocked=viewer)
        return queryset

    def manageable_by(self, user):
        """Profiles `user` may act as: their own and organizations they belong to."""
        if not user.is_authenticated:
            return self.none()
        return self.filter(Q(user=user) | Q(memberships__user=user)).distinct()

    def with_social_stats(self, viewer):
        """Annotate follower/following counts and the viewer's follow, block and mute state.

        `viewer` is the requesting user's profile, or None when signed out.
        """
        # Imported here: moderation's models depend on this module.
        from moderation.models import Block, Mute

        qs = self.annotate(
            follower_count=Count("followed_by", distinct=True),
            following_count=Count("follows", distinct=True),
        )
        if viewer is None:
            false = models.Value(False)
            return qs.annotate(is_followed=false, is_blocked=false, is_muted=false)
        return qs.annotate(
            is_followed=Exists(Follow.objects.filter(follower=viewer, followee=OuterRef("pk"))),
            is_blocked=Exists(Block.objects.filter(blocker=viewer, blocked=OuterRef("pk"))),
            is_muted=Exists(Mute.objects.filter(muter=viewer, muted=OuterRef("pk"))),
        )


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
    avatar = models.ForeignKey(
        "images.Image", on_delete=models.SET_NULL, null=True, blank=True, related_name="avatar_of"
    )
    cover = models.ForeignKey(
        "images.Image", on_delete=models.SET_NULL, null=True, blank=True, related_name="cover_of"
    )
    # What the person likes; used for recommendations.
    interests = models.ManyToManyField("events.Category", blank=True, related_name="interested")
    # Optional details people can show on their profile.
    pronouns = models.CharField(max_length=30, blank=True)
    university = models.CharField(max_length=100, blank=True)
    faculty = models.CharField(max_length=100, blank=True)
    study_year = models.PositiveSmallIntegerField(null=True, blank=True)
    website = models.URLField(blank=True)
    instagram = models.CharField(max_length=30, blank=True, validators=[instagram_validator])
    # Set by moderators for official organizations (student unions, guilds, clubs).
    verified = models.BooleanField(default=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="profile",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Set by moderators; hides the profile and everything it published.
    removed_at = models.DateTimeField(null=True, blank=True)

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
