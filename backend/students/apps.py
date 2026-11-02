from django.apps import AppConfig


class StudentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "students"

    def ready(self):
        from allauth.account.signals import email_confirmed

        from .services import verify_from_signup_email

        def on_email_confirmed(request, email_address, **kwargs):
            verify_from_signup_email(email_address.user, email_address.email)

        email_confirmed.connect(on_email_confirmed, weak=False, dispatch_uid="students-email")
