"""Query helpers shared between apps."""

from django.db import models
from django.db.models.functions import Coalesce


def count_of(queryset):
    """A subquery counting `queryset`'s rows, for use in annotations."""
    counted = queryset.order_by().annotate(n=models.Func(models.F("pk"), function="COUNT"))
    return Coalesce(models.Subquery(counted.values("n")), 0)
