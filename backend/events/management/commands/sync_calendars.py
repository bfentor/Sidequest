from django.core.management.base import BaseCommand

from events.calendars import sync_all


class Command(BaseCommand):
    help = "Import and update events from the calendars profiles sync (run hourly)."

    def handle(self, *args, **options):
        self.stdout.write(f"Synced {sync_all()} calendars.")
