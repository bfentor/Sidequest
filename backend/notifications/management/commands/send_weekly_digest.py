from django.conf import settings
from django.core.management.base import BaseCommand

from notifications.digest import send_due


class Command(BaseCommand):
    help = "Email the weekly summary of upcoming events to everyone who turned it on."

    def handle(self, *args, **options):
        self.stdout.write(f"Sent {send_due(settings.API_URL)} digests.")
