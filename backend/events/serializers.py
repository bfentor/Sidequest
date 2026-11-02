from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from images.serializers import ImageSerializer, OwnImageField
from notifications.models import Kind
from notifications.services import attendees_of, notify
from profiles.serializers import ActingProfileField, ProfileSummarySerializer

from .fields import LatLngField
from .models import Attendance, Category, Event
from .services import publish_event


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True, help_text="In the request's language.")

    class Meta:
        model = Category
        fields = ["slug", "name", "icon"]
        read_only_fields = fields


class AttendanceSummarySerializer(serializers.Serializer):
    going = serializers.IntegerField()
    interested = serializers.IntegerField()
    waitlisted = serializers.IntegerField()
    mine = serializers.ChoiceField(
        choices=Attendance.Status.choices,
        allow_null=True,
        help_text="The signed-in user's RSVP, if any.",
    )
    is_full = serializers.BooleanField()


def attendance_summary(event, viewer):
    """Counts from `with_attendance` annotations, or queried for a single event."""
    if hasattr(event, "going_count"):
        going, interested = event.going_count, event.interested_count
        waitlisted, mine = event.waitlist_count, event.my_status
    else:
        counts = {status: 0 for status in Attendance.Status.values}
        for status in event.attendances.values_list("status", flat=True):
            counts[status] += 1
        going, interested = counts["going"], counts["interested"]
        waitlisted = counts["waitlisted"]
        mine = (
            event.attendances.filter(profile=viewer).values_list("status", flat=True).first()
            if viewer is not None
            else None
        )
    return {
        "going": going,
        "interested": interested,
        "waitlisted": waitlisted,
        "mine": mine,
        "is_full": event.capacity is not None and going >= event.capacity,
    }


class GeocodeResultSerializer(serializers.Serializer):
    label = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class RsvpSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[Attendance.Status.GOING, Attendance.Status.INTERESTED],
        help_text="Going to a full event puts you on the waitlist.",
    )


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
    capacity = serializers.IntegerField(min_value=1, allow_null=True, required=False)
    cover = ImageSerializer(read_only=True, allow_null=True)
    cover_id = OwnImageField(
        source="cover",
        write_only=True,
        required=False,
        allow_null=True,
        help_text="An image uploaded with POST /api/images/.",
    )
    price = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
        help_text="In euros; empty for free events.",
    )
    attendance = serializers.SerializerMethodField()

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
            "capacity",
            "cover",
            "cover_id",
            "online_url",
            "price",
            "ticket_url",
            "attendance",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(AttendanceSummarySerializer)
    def get_attendance(self, event):
        request = self.context.get("request")
        viewer = request.user.profile if request and request.user.is_authenticated else None
        return attendance_summary(event, viewer)

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

    # Changing any of these tells everyone going or interested.
    NOTIFY_ON_CHANGE = ("starts_at", "ends_at", "location", "venue_name", "address", "online_url")

    def update(self, instance, validated_data):
        # An event's organizer is fixed once it has been published.
        validated_data.pop("organizer", None)
        changed = any(
            field in validated_data and validated_data[field] != getattr(instance, field)
            for field in self.NOTIFY_ON_CHANGE
        )
        event = super().update(instance, validated_data)
        if changed:
            notify(attendees_of(event), Kind.EVENT_CHANGED, actor=event.organizer, event=event)
        return event


class NearbyEventSerializer(EventSerializer):
    distance_m = serializers.SerializerMethodField()

    class Meta(EventSerializer.Meta):
        fields = [*EventSerializer.Meta.fields, "distance_m"]

    def get_distance_m(self, event) -> float:
        return event.distance.m
