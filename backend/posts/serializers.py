from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from events.models import Event
from events.serializers import EventSerializer
from images.serializers import ImageSerializer, OwnImageField
from profiles.serializers import ActingProfileField, ProfileSummarySerializer

from .models import Post, PostImage

# Pictures a post may have.
MAX_IMAGES = 4


class PostSerializer(serializers.ModelSerializer):
    author = ProfileSummarySerializer(read_only=True)
    author_handle = ActingProfileField(
        source="author",
        help_text="Post as this profile (yourself or an organization you belong to). "
        "Defaults to your own profile.",
    )
    event = EventSerializer(read_only=True, allow_null=True)
    event_id = serializers.PrimaryKeyRelatedField(
        source="event",
        queryset=Event.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        help_text="Attach (share) an existing event.",
    )
    images = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField(help_text="Whether you liked this post.")
    image_ids = serializers.ListField(
        child=OwnImageField(),
        write_only=True,
        required=False,
        max_length=MAX_IMAGES,
        help_text=f"Up to {MAX_IMAGES} images uploaded with POST /api/images/, in order. "
        "On edit, replaces the post's pictures.",
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "author",
            "author_handle",
            "body",
            "event",
            "event_id",
            "images",
            "image_ids",
            "like_count",
            "is_liked",
            "created_at",
            "edited_at",
        ]
        read_only_fields = ["edited_at"]

    @extend_schema_field(ImageSerializer(many=True))
    def get_images(self, post):
        links = post.image_links.all()
        return ImageSerializer([link.image for link in links], many=True, context=self.context).data

    # Annotated by for_display; a just-created post has none yet.
    def get_like_count(self, post) -> int:
        return getattr(post, "like_count", 0)

    def get_is_liked(self, post) -> bool:
        return getattr(post, "is_liked", False)

    def validate_image_ids(self, images):
        if len(set(images)) != len(images):
            raise serializers.ValidationError(_("The same picture is in the post twice."))
        return images

    def validate(self, attrs):
        post = self.instance
        body = attrs.get("body", post.body if post else "")
        event = attrs.get("event", post.event if post else None)
        has_images = (
            bool(attrs["image_ids"])
            if "image_ids" in attrs
            else bool(post and post.image_links.exists())
        )
        if not body.strip() and event is None and not has_images:
            raise serializers.ValidationError(_("A post needs text, a picture or an event."))
        return attrs

    def _set_images(self, post, images):
        post.image_links.all().delete()
        PostImage.objects.bulk_create(
            PostImage(post=post, image=image, position=position)
            for position, image in enumerate(images)
        )

    @transaction.atomic
    def create(self, validated_data):
        images = validated_data.pop("image_ids", [])
        post = super().create(validated_data)
        self._set_images(post, images)
        return post

    @transaction.atomic
    def update(self, instance, validated_data):
        # Who wrote it can't change.
        validated_data.pop("author", None)
        images = validated_data.pop("image_ids", None)
        if images is not None:
            self._set_images(instance, images)
        if images is not None or validated_data.get("body", instance.body) != instance.body:
            validated_data["edited_at"] = timezone.now()
        return super().update(instance, validated_data)
