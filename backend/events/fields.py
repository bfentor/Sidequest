from django.contrib.gis.geos import Point
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class LatLngSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


@extend_schema_field(LatLngSerializer)
class LatLngField(serializers.Field):
    """Exposes a GEOS Point as `{"lat": ..., "lng": ...}`.

    Clients never have to know about GeoJSON or that PostGIS stores points
    as (longitude, latitude).
    """

    def to_representation(self, value):
        return {"lat": value.y, "lng": value.x}

    def to_internal_value(self, data):
        coords = LatLngSerializer(data=data)
        coords.is_valid(raise_exception=True)
        return Point(coords.validated_data["lng"], coords.validated_data["lat"], srid=4326)
