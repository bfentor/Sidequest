from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Image
from .processing import MAX_UPLOAD_BYTES, normalize


class ImageSerializer(serializers.ModelSerializer):
    """How images appear inside other resources."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ["id", "url", "width", "height"]
        read_only_fields = fields

    def get_url(self, image) -> str:
        url = image.file.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class ImageUploadSerializer(ImageSerializer):
    file = serializers.ImageField(write_only=True)

    class Meta(ImageSerializer.Meta):
        fields = [*ImageSerializer.Meta.fields, "file"]
        read_only_fields = ImageSerializer.Meta.fields

    def validate_file(self, upload):
        if upload.size > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError(_("The picture is too large (at most 10 MB)."))
        return normalize(upload)

    def create(self, validated_data):
        return Image.objects.create(uploader=self.context["request"].user, **validated_data)


class OwnImageField(serializers.PrimaryKeyRelatedField):
    """Refers to an image the requesting user uploaded."""

    def get_queryset(self):
        return Image.objects.filter(uploader=self.context["request"].user)
