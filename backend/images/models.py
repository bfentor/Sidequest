from django.conf import settings
from django.db import models
from django.utils import timezone


def image_path(instance, filename):
    return f"images/{timezone.now():%Y/%m}/{filename}"


class Image(models.Model):
    """An uploaded picture, already normalised (see processing.py).

    Images are uploaded first and then attached by id to a profile, event or
    post. Ones that never get attached are removed by `delete_orphan_images`.
    """

    # Kept when the uploader's account is deleted, so an organization's
    # pictures don't disappear with the member who uploaded them.
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="images"
    )
    file = models.ImageField(upload_to=image_path, width_field="width", height_field="height")
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name

    @classmethod
    def orphans(cls):
        """Images that nothing refers to, whatever models point at Image."""
        queryset = cls.objects.all()
        for relation in cls._meta.related_objects:
            queryset = queryset.filter(**{f"{relation.field.related_query_name()}__isnull": True})
        return queryset
