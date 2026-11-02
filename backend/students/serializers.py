from rest_framework import serializers

from .models import StudentStatus, University


class UniversitySerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = ["id", "name", "short_name"]
        read_only_fields = fields


class StudentStatusSerializer(serializers.ModelSerializer):
    university = UniversitySerializer(read_only=True)
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        model = StudentStatus
        fields = ["university", "email", "verified_at", "is_current"]
        read_only_fields = fields


class StudentEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Your university email address.")


class StudentCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10)
