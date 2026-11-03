import hashlib

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models


class Flag(models.Model):
    """A feature that can be switched on without a release: for testers, staff, some or everyone.

    Unknown flags are off, so the app can ship a feature behind a flag before
    the flag exists here.
    """

    name = models.SlugField(max_length=50, unique=True, help_text="What the app asks for.")
    description = models.CharField(max_length=200, blank=True)
    everyone = models.BooleanField(default=False, help_text="On for everyone, signed in or not.")
    staff = models.BooleanField(default=False, help_text="On for staff accounts.")
    percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
        help_text="On for this share of signed-in people (always the same ones).",
    )
    testers = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def is_on_for(self, user):
        if self.everyone:
            return True
        if not user.is_authenticated:
            return False
        if self.staff and user.is_staff:
            return True
        if self.percent and self._bucket(user) < self.percent:
            return True
        # all() uses the testers prefetched by the view.
        return any(tester.pk == user.pk for tester in self.testers.all())

    def _bucket(self, user):
        """0–99, stable per person and flag, so a rollout grows without reshuffling who has it."""
        digest = hashlib.sha256(f"{self.name}:{user.pk}".encode()).digest()
        return int.from_bytes(digest[:4], "big") % 100
