from django.db import transaction

from notifications.models import Kind
from notifications.services import followers_of, notify
from posts.models import Post

from .models import Event


@transaction.atomic
def publish_event(**fields):
    """Create an event and announce it in its organizer's followers' feeds."""
    event = Event.objects.create(**fields)
    Post.objects.create(author=event.organizer, event=event)
    notify(followers_of(event.organizer), Kind.NEW_EVENT, actor=event.organizer, event=event)
    return event
