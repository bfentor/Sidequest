"""Automatic checks on what people write: spam, and terms moderators listed.

`check` runs before a post, comment or event is saved and rejects what's
clearly unwanted; `flag` runs after, filing a report for the moderation
queue when a "flag" term appears.
"""

import re
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers

from .models import FilteredTerm, Report

# More links than this in one text looks like spam.
MAX_LINKS = 5
LINK = re.compile(r"https?://", re.IGNORECASE)
# Posting the same text again this soon looks like spam.
REPEAT_WINDOW = timedelta(minutes=10)


def _matches(text, action):
    """The listed terms with `action` that appear in `text` as whole words."""
    text = text.lower()
    return [
        term
        for term in FilteredTerm.objects.filter(action=action).values_list("term", flat=True)
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text)
    ]


def check(text, *, recent=None):
    """Raise a ValidationError if `text` is spam or contains a blocked term.

    `recent` is a queryset of the author's earlier texts of the same kind,
    with a `body` field, to catch the same thing posted again and again.
    """
    if not text:
        return
    if len(LINK.findall(text)) > MAX_LINKS:
        raise serializers.ValidationError(_("That's a lot of links. Keep it to five or fewer."))
    if _matches(text, FilteredTerm.Action.BLOCK):
        raise serializers.ValidationError(_("This contains words that aren't allowed here."))
    if recent is not None and len(text) >= 20:
        if recent.filter(body=text, created_at__gte=timezone.now() - REPEAT_WINDOW).exists():
            raise serializers.ValidationError(_("You just posted this."))


def flag(obj, text):
    """Report `obj` to moderators (with no reporter: it was automatic) if `text` has a flag term."""
    terms = _matches(text or "", FilteredTerm.Action.FLAG)
    if not terms:
        return
    content_type = ContentType.objects.get_for_model(obj)
    already = Report.objects.filter(
        content_type=content_type, object_id=obj.pk, reporter=None, status=Report.Status.OPEN
    )
    if not already.exists():
        Report.objects.create(
            reporter=None,
            content_type=content_type,
            object_id=obj.pk,
            reason=Report.Reason.OTHER,
            details="Automatic: contains " + ", ".join(f"\u201c{term}\u201d" for term in terms),
        )
