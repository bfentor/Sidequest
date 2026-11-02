from rest_framework import serializers

from images.serializers import ImageSerializer, OwnImageField

from .models import Profile


class ProfileSummarySerializer(serializers.ModelSerializer):
    """Compact profile representation embedded in events and posts."""

    avatar = ImageSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Profile
        fields = ["handle", "display_name", "kind", "avatar"]
        read_only_fields = fields


class ProfileSerializer(serializers.ModelSerializer):
    """Full profile. Expects a queryset annotated with `with_social_stats`."""

    avatar = ImageSerializer(read_only=True, allow_null=True)
    avatar_id = OwnImageField(
        source="avatar",
        write_only=True,
        required=False,
        allow_null=True,
        help_text="An image uploaded with POST /api/images/.",
    )
    follower_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    is_followed = serializers.BooleanField(read_only=True)
    is_blocked = serializers.BooleanField(read_only=True)
    is_muted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = [
            "handle",
            "display_name",
            "kind",
            "bio",
            "avatar",
            "avatar_id",
            "created_at",
            "follower_count",
            "following_count",
            "is_followed",
            "is_blocked",
            "is_muted",
        ]
        read_only_fields = ["kind", "created_at"]


class CurrentProfileDefault:
    """Field default resolving to the requesting user's own profile."""

    requires_context = True

    def __call__(self, serializer_field):
        return serializer_field.context["request"].user.profile


class ActingProfileField(serializers.SlugRelatedField):
    """Write-only handle of a profile the requesting user may act as.

    Used to publish as yourself (the default) or as an organization you
    belong to.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("default", CurrentProfileDefault())
        super().__init__(slug_field="handle", write_only=True, **kwargs)

    def get_queryset(self):
        return Profile.objects.manageable_by(self.context["request"].user)
