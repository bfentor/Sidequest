from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

# Student status is confirmed again after this long (people graduate).
VERIFICATION_VALID_FOR = timedelta(days=400)


class University(models.Model):
    name = models.CharField(max_length=150)
    short_name = models.CharField(max_length=30)
    # Comma-separated email domains; subdomains match too (lut.fi covers student.lut.fi).
    email_domains = models.CharField(max_length=300)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "universities"

    def __str__(self):
        return self.name

    @property
    def domains(self):
        return [
            domain.strip().lower() for domain in self.email_domains.split(",") if domain.strip()
        ]

    @classmethod
    def for_email(cls, email):
        """The university an email address belongs to, if any."""
        domain = email.rsplit("@", 1)[-1].lower()
        for university in cls.objects.all():
            if any(domain == d or domain.endswith(f".{d}") for d in university.domains):
                return university
        return None


class StudentStatus(models.Model):
    """A person shown to be a student, by a code sent to their university address."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student_status"
    )
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="students")
    email = models.EmailField()
    verified_at = models.DateTimeField()

    def __str__(self):
        return f"{self.user} at {self.university}"

    @property
    def is_current(self):
        return self.verified_at > timezone.now() - VERIFICATION_VALID_FOR


class VerificationCode(models.Model):
    """A pending student verification: the (hashed) code sent to a university address."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student_code"
    )
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="+")
    email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"Student verification of {self.email}"
