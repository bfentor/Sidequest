from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from profiles.serializers import ActingProfileField, ProfileSummarySerializer

from .fields import LatLngField
from .models import Category, Event
from .services import publish_event


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True, help_text="In the request's language.")

    class Meta:
        model = Category
        fields = ["slug", "name", "icon"]
        read_only_fields = fields


class EventSerializer(serializers.ModelSerializer):
    organizer = ProfileSummarySerializer(read_only=True)
    organizer_handle = ActingProfileField(
        source="organizer",
        help_text="Publish as this profile (yourself or an organization you belong to). "
        "Defaults to your own profile. Only used on create.",
    )
    location = LatLngField(allow_null=True, required=False)
    categories = serializers.SlugRelatedField(
        slug_field="slug", many=True, queryset=Category.objects.all(), required=False
    )

    class Meta:
        model = Event
        fields = [
            "id",
            "organizer",
            "organizer_handle",
            "title",
            "description",
            "starts_at",
            "ends_at",
            "venue_name",
            "address",
            "location",
            "categories",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": _("Must be after the start time.")})
        return attrs

    def create(self, validated_data):
        categories = validated_data.pop("categories", [])
        event = publish_event(**validated_data)
        event.categories.set(categories)
        return event

    def update(self, instance, validated_data):
        # An event's organizer is fixed once it has been published.
        validated_data.pop("organizer", None)
        return super().update(instance, validated_data)


class NearbyEventSerializer(EventSerializer):
    distance_m = serializers.SerializerMethodField()

    class Meta(EventSerializer.Meta):
        fields = [*EventSerializer.Meta.fields, "distance_m"]

    def get_distance_m(self, event) -> float:
        return event.distance.m
