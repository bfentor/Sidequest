from django.core.management.base import BaseCommand

from notifications.push import send_pending


class Command(BaseCommand):
    help = "Send push notifications for new inbox entries (run every minute)."

    def handle(self, *args, **options):
        self.stdout.write(f"Sent {send_pending()} push notifications.")
