from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        # allauth's account modules import each other in a circle. When the dev
        # server reloads, two threads can import them at the same moment, which
        # Python 3.14 reports as an import deadlock. Importing them here, while
        # Django sets up on one thread, means they're loaded before that.
        import allauth.account.utils  # noqa: F401
