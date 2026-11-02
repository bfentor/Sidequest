import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone, translation
from django.utils.translation import gettext as _

from .models import StudentStatus, University, VerificationCode

CODE_VALID_FOR = timedelta(minutes=15)
MAX_ATTEMPTS = 5


class VerificationError(Exception):
    pass


def send_code(user, email):
    """Email a code to a university address. Raises VerificationError if it isn't one."""
    university = University.for_email(email)
    if university is None:
        raise VerificationError(_("This isn't a university email address we know."))
    code = f"{secrets.randbelow(10**6):06d}"
    VerificationCode.objects.update_or_create(
        user=user,
        defaults={
            "university": university,
            "email": email,
            "code_hash": make_password(code),
            "attempts": 0,
            "expires_at": timezone.now() + CODE_VALID_FOR,
        },
    )
    with translation.override(user.language):
        send_mail(
            _("[Sidequest] Your student verification code"),
            _(
                "Your code is %(code)s. Enter it in Sidequest within 15 minutes to show "
                "you study at %(university)s. If you didn't ask for this, ignore this email."
            )
            % {"code": code, "university": university.name},
            settings.DEFAULT_FROM_EMAIL,
            [email],
        )
    return university


def confirm_code(user, code):
    """Check a code; on success, the user is a verified student. Raises VerificationError."""
    status, problem = _check_code(user, code)
    # Raised only now, after the transaction committed: a wrong guess must still count.
    if problem:
        raise VerificationError(problem)
    return status


@transaction.atomic
def _check_code(user, code):
    pending = VerificationCode.objects.select_for_update().filter(user=user).first()
    if pending is None or pending.expires_at < timezone.now():
        return None, _("The code has expired. Ask for a new one.")
    if pending.attempts >= MAX_ATTEMPTS:
        return None, _("Too many wrong codes. Ask for a new one.")
    if not check_password(code.strip(), pending.code_hash):
        pending.attempts += 1
        pending.save(update_fields=["attempts"])
        return None, _("The code is wrong.")

    status, _created = StudentStatus.objects.update_or_create(
        user=user,
        defaults={
            "university": pending.university,
            "email": pending.email,
            "verified_at": timezone.now(),
        },
    )
    pending.delete()
    return status, None


def verify_from_signup_email(user, email):
    """A verified sign-in address at a university counts as student verification too."""
    university = University.for_email(email)
    if university is not None:
        StudentStatus.objects.update_or_create(
            user=user,
            defaults={"university": university, "email": email, "verified_at": timezone.now()},
        )


def current_university(user):
    """The university the user is currently a verified student of, or None."""
    status = getattr(user, "student_status", None)
    return status.university if status is not None and status.is_current else None
