from django.core.management.base import BaseCommand

from events.services import request_feedback_due


class Command(BaseCommand):
    help = "Ask people who went to events that just ended how they were (run every few minutes)."

    def handle(self, *args, **options):
        self.stdout.write(f"Asked for feedback on {request_feedback_due()} events.")
