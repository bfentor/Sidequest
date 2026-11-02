"""@mentions and #hashtags in what people write (posts and comments).

The app recognises the same patterns (components/rich-text.tsx), so keep them in step.
"""

import re

from events.models import Event
from notifications.models import Kind
from notifications.services import managers_of, notify
from profiles.models import Profile

from .models import Post

# Handles are lowercase letters, numbers and underscores; people may type them in any case.
MENTION = re.compile(r"(?<![\w@])@([A-Za-z0-9_]{1,30})(?!\w)")
# Letters in any language, numbers and underscores; "&#39;" and "a#b" aren't tags.
HASHTAG = re.compile(r"(?<![\w#&])#(\w{1,50})")
# Mentions beyond this many in one text don't notify anyone, which keeps it from being used to spam.
MAX_MENTIONS = 10


def mentioned_handles(text):
    """The handles @mentioned in `text`, lowercased, in order, without repeats."""
    handles = dict.fromkeys(match.lower() for match in MENTION.findall(text))
    return list(handles)[:MAX_MENTIONS]


def hashtag_pattern(tag):
    """A PostgreSQL regex matching `#tag` as a whole tag (case-insensitively with __iregex)."""
    return rf"(^|[^[:alnum:]_#&])#{re.escape(tag)}([^[:alnum:]_]|$)"


def notify_mentions(text, *, author, before="", post=None, event=None):
    """Tell profiles @mentioned in `text` (and not already in `before`, the text before an edit).

    The people acting for a mentioned profile (an organization's admins) hear
    about it only if they can see the post or event, so a mention never
    reveals something private.
    """
    handles = set(mentioned_handles(text)) - set(mentioned_handles(before))
    for profile in Profile.objects.filter(handle__in=handles, removed_at__isnull=True):
        readers = [user for user in managers_of(profile) if can_see(user.profile, post, event)]
        notify(readers, Kind.MENTION, actor=author, post=post, event=event)


def can_see(viewer, post, event):
    if post is not None and not Post.objects.visible_to(viewer).filter(pk=post.pk).exists():
        return False
    return event is None or Event.objects.visible_to(viewer).filter(pk=event.pk).exists()
