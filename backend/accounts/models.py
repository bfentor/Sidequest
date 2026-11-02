from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone

from .signup import age_on


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """A login account.

    Users sign in with their email address. Everything public (handle, name,
    followers) lives on `profiles.Profile`, which every user gets one of.
    """

    username = None
    email = models.EmailField("email address", unique=True)
    # The app's language, for things sent outside the app (push notifications, emails).
    language = models.CharField(
        max_length=8, choices=settings.LANGUAGES, default=settings.LANGUAGE_CODE
    )
    birth_date = models.DateField(null=True, blank=True)
    # Which version of the terms of service (settings.TERMS_VERSION) they accepted, and when.
    terms_version = models.CharField(max_length=20, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    # When they finished (or skipped) the app's first-run steps; None shows them again.
    onboarded_at = models.DateTimeField(null=True, blank=True)

    @property
    def age(self):
        """Age in whole years, or None when the birth date isn't known."""
        return age_on(self.birth_date, timezone.localdate()) if self.birth_date else None

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email
