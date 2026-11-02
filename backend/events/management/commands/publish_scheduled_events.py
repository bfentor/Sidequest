from django.core.management.base import BaseCommand

from events.services import publish_due


class Command(BaseCommand):
    help = "Announce scheduled events whose publishing time has come (run every minute)."

    def handle(self, *args, **options):
        self.stdout.write(f"Published {publish_due()} scheduled events.")
