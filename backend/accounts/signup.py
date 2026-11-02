from datetime import date

from django import forms
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


def age_on(birth_date: date, today: date) -> int:
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


class SignupForm(forms.Form):
    """Extra signup fields, added to allauth's (ACCOUNT_SIGNUP_FORM_CLASS)."""

    birth_date = forms.DateField()
    accept_terms = forms.BooleanField(
        error_messages={
            "required": _("Accept the terms of service and privacy policy to continue.")
        }
    )

    def clean_birth_date(self):
        birth_date = self.cleaned_data["birth_date"]
        if age_on(birth_date, timezone.localdate()) < settings.MINIMUM_AGE:
            raise forms.ValidationError(
                _("You need to be at least %(age)s years old to use Sidequest.")
                % {"age": settings.MINIMUM_AGE}
            )
        return birth_date

    def signup(self, request, user):
        user.birth_date = self.cleaned_data["birth_date"]
        user.terms_accepted_at = timezone.now()
        user.terms_version = settings.TERMS_VERSION
        user.save(update_fields=["birth_date", "terms_accepted_at", "terms_version"])
