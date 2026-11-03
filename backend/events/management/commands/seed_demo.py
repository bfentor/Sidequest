from datetime import date, timedelta

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from events.services import publish_event
from posts.models import Post
from profiles.models import Follow, Membership, Profile

DEMO_PASSWORD = "sidequest-demo"

# (title, venue, (lng, lat), starts in hours, duration in hours)
EVENTS = [
    ("Board game night", "Student union building", (28.0951, 61.0647), 3, 4),
    ("Morning run by the lake", "Myllysaari beach", (28.1665, 61.0532), 20, 1),
    ("Startup pitch evening", "Main campus auditorium", (28.0934, 61.0652), 50, 3),
    ("Sauna & swim", "Lake Saimaa harbour", (28.1820, 61.0645), 74, 3),
    ("Hackathon kick-off", "Helsinki city centre", (24.9384, 60.1699), 30, 8),
    ("Open-air cinema", "Esplanadi park", (24.9497, 60.1675), 98, 3),
]


class Command(BaseCommand):
    help = "Create demo users, organizations, events and posts for local development."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Refusing to seed demo data with DEBUG off.")
        if User.objects.filter(email="demo@sidequest.test").exists():
            self.stdout.write("Demo data already exists.")
            return
        self.seed()
        message = f"Seeded demo data. Sign in as demo@sidequest.test / {DEMO_PASSWORD}"
        self.stdout.write(self.style.SUCCESS(message))

    @transaction.atomic
    def seed(self):
        adult = {
            "birth_date": date(2002, 5, 17),
            "terms_version": settings.TERMS_VERSION,
            "terms_accepted_at": timezone.now(),
            # Straight to the app, without the first-run steps.
            "onboarded_at": timezone.now(),
        }
        demo = User.objects.create_user(
            email="demo@sidequest.test", password=DEMO_PASSWORD, **adult
        )
        friend = User.objects.create_user(
            email="sam@sidequest.test", password=DEMO_PASSWORD, **adult
        )
        # Demo accounts can sign in straight away, without the emailed code.
        for user in (demo, friend):
            EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
        union = Profile.objects.create(
            kind=Profile.Kind.ORGANIZATION,
            handle="student_union",
            display_name="Student Union",
            bio="Events for every student.",
        )
        Membership.objects.create(organization=union, user=friend, role=Membership.Role.ADMIN)
        Follow.objects.create(follower=demo.profile, followee=union)
        Follow.objects.create(follower=demo.profile, followee=friend.profile)

        now = timezone.now()
        for index, (title, venue, (lng, lat), starts_in, hours) in enumerate(EVENTS):
            starts_at = now + timedelta(hours=starts_in)
            publish_event(
                organizer=union if index % 2 == 0 else friend.profile,
                title=title,
                venue_name=venue,
                location=Point(lng, lat, srid=4326),
                starts_at=starts_at,
                ends_at=starts_at + timedelta(hours=hours),
            )
        Post.objects.create(author=friend.profile, body="Who's coming to board game night?")
