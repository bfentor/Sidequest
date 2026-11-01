from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .services import create_person_profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile_for_new_user(sender, instance, created, raw, **kwargs):
    # Covers every way a user can be created: signup, admin, createsuperuser.
    if created and not raw:
        create_person_profile(instance)
