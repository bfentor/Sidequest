from django.db import transaction

from posts.models import Post

from .models import Event


@transaction.atomic
def publish_event(**fields):
    """Create an event and announce it in its organizer's followers' feeds."""
    event = Event.objects.create(**fields)
    Post.objects.create(author=event.organizer, event=event)
    return event
