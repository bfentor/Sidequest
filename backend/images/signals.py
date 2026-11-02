from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Image


@receiver(post_delete, sender=Image)
def delete_file_with_image(sender, instance, **kwargs):
    instance.file.delete(save=False)
