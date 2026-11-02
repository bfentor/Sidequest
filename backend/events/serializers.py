from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from images.serializers import ImageSerializer, OwnImageField
from notifications.models import Kind
from notifications.services import attendees_of, notify
from profiles.models import Profile
from profiles.serializers import ActingProfileField, ProfileSummarySerializer

from .fields import LatLngField
from .models import Attendance, Category, CoHost, Event
from .services import REPEAT_FREQUENCIES, announce, invite_co_hosts, publish_event


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


class RepeatSerializer(serializers.Serializer):
    frequency = serializers.ChoiceField(choices=REPEAT_FREQUENCIES)
    count = serializers.IntegerField(
        min_value=2, max_value=26, help_text="How many dates in total, the first included."
    )


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
    co_hosts = serializers.SerializerMethodField(help_text="Co-hosts who accepted.")
    co_host_handles = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="Profiles to ask to co-host; leaving one out removes it.",
    )
    repeat = RepeatSerializer(
        write_only=True, required=False, help_text="Create a series of dates. Only on create."
    )
    published_at = serializers.DateTimeField(
        allow_null=True,
        required=False,
        help_text="Leave out to publish now; empty for a draft; a future time to schedule.",
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
            "capacity",
            "cover",
            "cover_id",
            "online_url",
            "price",
            "ticket_url",
            "visibility",
            "status",
            "published_at",
            "series_id",
            "co_hosts",
            "co_host_handles",
            "repeat",
            "attendance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["series_id"]

    @extend_schema_field(ProfileSummarySerializer(many=True))
    def get_co_hosts(self, event):
        accepted = [link.profile for link in event.co_host_links.all() if link.accepted_at]
        return ProfileSummarySerializer(accepted, many=True, context=self.context).data

    def validate_co_host_handles(self, handles):
        profiles = list(Profile.objects.filter(handle__in=handles, removed_at__isnull=True))
        missing = set(handles) - {profile.handle for profile in profiles}
        if missing:
            raise serializers.ValidationError(
                _("No profile has the username %(handle)s.") % {"handle": sorted(missing)[0]}
            )
        return profiles

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
        validated_data.setdefault("published_at", timezone.now())
        return publish_event(
            categories=validated_data.pop("categories", []),
            co_hosts=validated_data.pop("co_host_handles", []),
            **validated_data,
        )

    # Changing any of these tells everyone going or interested.
    NOTIFY_ON_CHANGE = ("starts_at", "ends_at", "location", "venue_name", "address", "online_url")

    def update(self, instance, validated_data):
        # The organizer is fixed once published, and series are made on create only.
        validated_data.pop("organizer", None)
        validated_data.pop("repeat", None)
        co_hosts = validated_data.pop("co_host_handles", None)
        old_status = instance.status
        changed = any(
            field in validated_data and validated_data[field] != getattr(instance, field)
            for field in self.NOTIFY_ON_CHANGE
        )
        event = super().update(instance, validated_data)

        if co_hosts is not None:
            CoHost.objects.filter(event=event).exclude(profile__in=co_hosts).delete()
            invite_co_hosts(event, co_hosts)
        if event.published_at is not None and event.published_at <= timezone.now():
            announce(event)

        kind = None
        if event.status != old_status:
            kind = {
                Event.Status.CANCELLED: Kind.EVENT_CANCELLED,
                Event.Status.POSTPONED: Kind.EVENT_POSTPONED,
                Event.Status.ACTIVE: Kind.EVENT_CHANGED,
            }[event.status]
        elif changed:
            kind = Kind.EVENT_CHANGED
        if kind is not None:
            notify(attendees_of(event), kind, actor=event.organizer, event=event)
        return event


class NearbyEventSerializer(EventSerializer):
    distance_m = serializers.SerializerMethodField()

    class Meta(EventSerializer.Meta):
        fields = [*EventSerializer.Meta.fields, "distance_m"]

    def get_distance_m(self, event) -> float:
        return event.distance.m
