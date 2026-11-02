from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from events.models import Event
from posts.models import Comment, Post
from profiles.models import Profile

from .models import Report
from .visibility import viewer_profile


def _find_post(key, viewer):
    return Post.objects.visible_to(viewer).filter(pk=key).first() if key.isdigit() else None


def _find_event(key, viewer):
    return Event.objects.visible_to(viewer).filter(pk=key).first() if key.isdigit() else None


def _find_profile(key, viewer):
    return Profile.objects.visible_to(viewer).filter(handle=key).first()


def _find_comment(key, viewer):
    return Comment.objects.visible_to(viewer).filter(pk=key).first() if key.isdigit() else None


TARGET_FINDERS = {
    "post": _find_post,
    "event": _find_event,
    "profile": _find_profile,
    "comment": _find_comment,
}


class ReportSerializer(serializers.ModelSerializer):
    target_type = serializers.ChoiceField(choices=list(TARGET_FINDERS), write_only=True)
    target_id = serializers.CharField(
        write_only=True, help_text="The post's or event's id, or the profile's handle."
    )

    class Meta:
        model = Report
        fields = ["id", "target_type", "target_id", "reason", "details", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        viewer = viewer_profile(self.context["request"])
        target = TARGET_FINDERS[attrs.pop("target_type")](attrs.pop("target_id"), viewer)
        if target is None:
            raise serializers.ValidationError({"target_id": _("This content no longer exists.")})
        attrs["content_type"] = ContentType.objects.get_for_model(target)
        attrs["object_id"] = target.pk
        return attrs

    def create(self, validated_data):
        return Report.objects.create(reporter=self.context["request"].user, **validated_data)
