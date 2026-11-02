from django.core.management.base import BaseCommand

from events.services import remind_due


class Command(BaseCommand):
    help = "Remind people about events starting soon (run every few minutes)."

    def handle(self, *args, **options):
        self.stdout.write(f"Sent reminders for {remind_due()} events.")
