from rest_framework import serializers

from events.models import Event
from events.serializers import EventSerializer
from profiles.serializers import ActingProfileField, ProfileSummarySerializer

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    author = ProfileSummarySerializer(read_only=True)
    author_handle = ActingProfileField(
        source="author",
        help_text="Post as this profile (yourself or an organization you belong to). "
        "Defaults to your own profile.",
    )
    event = EventSerializer(read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        source="event",
        queryset=Event.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        help_text="Attach (share) an existing event.",
    )

    class Meta:
        model = Post
        fields = ["id", "author", "author_handle", "body", "event", "event_id", "created_at"]

    def validate(self, attrs):
        if not attrs.get("body") and not attrs.get("event"):
            raise serializers.ValidationError("A post needs a body, an event, or both.")
        return attrs
