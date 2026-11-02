from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from images.models import Image


class Command(BaseCommand):
    help = "Delete uploaded images that were never attached (or no longer are) after a day."

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=1)
        orphans = Image.orphans().filter(created_at__lt=cutoff)
        count = 0
        # One by one, so each image's file is deleted too (signals.py).
        for image in orphans.iterator():
            image.delete()
            count += 1
        self.stdout.write(f"Deleted {count} orphan images.")
