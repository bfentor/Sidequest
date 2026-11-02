"""Django settings for the Sidequest API.

All environment-specific values come from environment variables (or a local
`.env` file, see `.env.example`), so the same settings module is used in
development, CI and production.
"""

import tomllib
from pathlib import Path

import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

with open(BASE_DIR / "pyproject.toml", "rb") as pyproject:
    APP_VERSION = tomllib.load(pyproject)["project"]["version"]

env = environ.Env()
env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(env_file)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# Where the frontend lives; used for links in emails (password reset etc.).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:8081")


# Applications

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    # Third party
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.headless",
    # Local
    "accounts",
    "images",
    "moderation",
    "profiles",
    "events",
    "posts",
    "feeds",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Picks the language from the request's Accept-Language header.
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# Database (must be PostGIS, e.g. postgis://user:pass@host:5432/name)

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Rate limits are counted in the cache, so deployments share one across
# processes: CACHE_URL=dbcache://django_cache (the entrypoint creates the table).
CACHES = {"default": env.cache("CACHE_URL", default="locmemcache://")}


# Authentication

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = env("ACCOUNT_EMAIL_VERIFICATION", default="optional")

# Every frontend (iOS, Android and web) authenticates with the X-Session-Token
# header, so only allauth's "app" client is enabled.
# Behind Cloudflare, the visitor's address is in CF-Connecting-IP; allauth's
# sign-in rate limits need it.
ALLAUTH_TRUSTED_CLIENT_IP_HEADER = env("ALLAUTH_TRUSTED_CLIENT_IP_HEADER", default=None)

HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("app",)
HEADLESS_SERVE_SPECIFICATION = DEBUG
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/verify-email/{{key}}",
    "account_reset_password_from_key": f"{FRONTEND_URL}/reset-password/{{key}}",
    "account_signup": f"{FRONTEND_URL}/sign-up",
}

MAILERS = {
    "default": {
        # Prints emails to the console by default. Set MAILER_BACKEND (and the
        # provider's OPTIONS here) once a transactional email service is chosen.
        "BACKEND": env("MAILER_BACKEND", default="django.core.mail.backends.console.EmailBackend"),
    },
}
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Sidequest <noreply@localhost>")


# API

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "allauth.headless.contrib.rest_framework.authentication.XSessionTokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ["config.throttling.WriteRateThrottle"],
    # Per signed-in user. Views opt in with `throttle_scope`.
    "DEFAULT_THROTTLE_RATES": {
        "posts": "30/hour",
        "events": "20/hour",
        "follows": "200/hour",
        "rsvps": "300/hour",
        "blocks": "60/hour",
        "reports": "20/hour",
        "uploads": "60/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Sidequest API",
    "VERSION": APP_VERSION,
    "SERVE_INCLUDE_SCHEMA": False,
    # Separate request/response components so generated clients know which
    # fields are read-only.
    "COMPONENT_SPLIT_REQUEST": True,
    # Readable names for enums in the generated TypeScript client.
    "ENUM_NAME_OVERRIDES": {
        "AttendanceStatusEnum": "events.models.Attendance.Status",
        "ProfileKindEnum": "profiles.models.Profile.Kind",
        "ReportReasonEnum": "moderation.models.Report.Reason",
    },
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_HEADERS = (*default_headers, "x-session-token")


# Internationalization

LANGUAGE_CODE = "en"
LANGUAGES = [
    ("en", "English"),
    ("fi", "Suomi"),
    ("sv", "Svenska"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Europe/Helsinki"
USE_I18N = True
USE_TZ = True


# Static and uploaded files

STATIC_URL = "static/"
STATIC_ROOT = env("STATIC_ROOT", default=str(BASE_DIR / "staticfiles"))
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Static files (the admin's) are served by WhiteNoise from the image.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# Fall back to unhashed names when collectstatic hasn't run (tests, development).
WHITENOISE_MANIFEST_STRICT = False

# Uploaded files go to S3-compatible object storage when a bucket is configured.
if env("AWS_STORAGE_BUCKET_NAME", default=""):
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("AWS_STORAGE_BUCKET_NAME"),
            "endpoint_url": env("AWS_S3_ENDPOINT_URL", default=None),
            "region_name": env("AWS_S3_REGION_NAME", default=None),
            "access_key": env("AWS_ACCESS_KEY_ID"),
            "secret_key": env("AWS_SECRET_ACCESS_KEY"),
            "custom_domain": env("AWS_S3_CUSTOM_DOMAIN", default=None),
            "default_acl": "public-read",
            "querystring_auth": False,
            "file_overwrite": False,
        },
    }


# Production

if not DEBUG:
    # TLS ends at the proxy (Cloudflare / Coolify's Traefik).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=env("SENTRY_ENVIRONMENT", default="staging"),
        release=APP_VERSION,
        send_default_pii=False,
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
    )
