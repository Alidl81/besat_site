from pathlib import Path
import importlib.util
from datetime import timedelta

import environ


BASE_DIR = Path(__file__).resolve().parent.parent.parent
APPS_DIR = BASE_DIR / "apps"

env = environ.Env(
    DEBUG=(bool, False),
    )


READ_DOT_ENV_FILE = env.bool("DJANGO_READ_DOT_ENV_FILE", default=True)

if READ_DOT_ENV_FILE:
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        environ.Env.read_env(env_file)


def csv_env(name: str, default: str = "") -> list[str]:
    value = env(name, default=default)
    return [item.strip() for item in value.split(",") if item.strip()]

SECRET_KEY = env("SECRET_KEY", default="unsafe-development-key-change-me")
DEBUG = env.bool("DEBUG", default=False)
# The production image installs django-prometheus from requirements. Keeping a
# capability flag makes local/audit containers with an older cached image
# degrade to the internal metrics fallback instead of failing the whole API at
# import time; a fresh release still uses the real package.
PROMETHEUS_AVAILABLE = importlib.util.find_spec("django_prometheus") is not None
ENABLE_API_DOCS = env.bool("ENABLE_API_DOCS", default=DEBUG)

ALLOWED_HOSTS = csv_env("ALLOWED_HOSTS", "localhost,127.0.0.1")

LANGUAGE_CODE = env("LANGUAGE_CODE", default="fa-ir")
TIME_ZONE = env("TIME_ZONE", default="Asia/Tehran")

USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "rest_framework_simplejwt.token_blacklist",
]
if PROMETHEUS_AVAILABLE:
    THIRD_PARTY_APPS.append("django_prometheus")

LOCAL_APPS = [
    "apps.core",
    "apps.site_settings",
    "apps.units",
    "apps.departments",
    "apps.news",
    "apps.gallery",
    "apps.achievements",
    "apps.content",
    "apps.registration",
    "apps.staff",
    "apps.accounts",
    "apps.announcements",
    "apps.dashboard",
    "apps.contact",
    "apps.about",
    "apps.home",
    "apps.events",
    "apps.shop",
    "apps.virtual_tour",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


MIDDLEWARE = ([
    # Outermost per django-prometheus's own requirement: sees the request
    # first and (because Django unwinds the response phase in reverse
    # middleware order) the response last, so its timing wraps everything
    # below it, including every other middleware.
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Needs the final response (status code) and, for `route`, the URL
    # resolver match that's only guaranteed populated once every earlier
    # middleware/the view has run -- placed just inside
    # PrometheusAfterMiddleware so it still sees that same final state.
    "apps.core.middleware.RequestLoggingMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
] if PROMETHEUS_AVAILABLE else [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.RequestLoggingMiddleware",
])


ROOT_URLCONF = "config.urls"

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
    }
]

WSGI_APPLICATION = "config.wsgi.application"


DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

# PostgreSQL-only server-side safety timeouts -- see
# docs/reliability/POSTGRESQL_RELIABILITY.md for the reasoning and the
# capacity math behind each value. Skipped for sqlite (the local
# no-Docker fallback default above), which doesn't understand libpq
# connection options. All three default to unlimited (0) in a stock
# PostgreSQL install, which is exactly the "long-running request"/
# "long transaction"/"lock wait forever" failure mode documented in
# docs/reliability/FAILURE_MATRIX.md -- this closes it at the connection
# level, independent of any one view remembering to set its own timeout.
if DATABASES["default"].get("ENGINE") == "django.db.backends.postgresql":
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["options"] = (
        # 30s: generously above any real request's expected query time
        # (the slowest endpoints in this app are simple list/detail
        # queries with default pagination), well below GUNICORN_TIMEOUT
        # (60s) so a runaway query is killed by Postgres before gunicorn
        # would otherwise kill the whole worker.
        "-c statement_timeout=30000 "
        # 60s: a transaction left open and idle (client crashed mid-
        # transaction, forgot to commit) releases its locks instead of
        # holding them indefinitely.
        "-c idle_in_transaction_session_timeout=60000 "
        # 10s: a request waiting on a row/table lock fails fast with a
        # clear error instead of queuing behind a stuck transaction for
        # the full statement_timeout.
        "-c lock_timeout=10000"
    )


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Empty by default so apps.accounts.invitations.email_backend_is_configured()
# can tell "SMTP actually configured" apart from Django's own EMAIL_HOST
# default of "localhost" (which would read as truthy even when unset).
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="besat@localhost")

# Used only to build the absolute set-password link embedded in invitation
# emails (the CMS UI itself builds the link from its own browser origin).
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:3000")

# Payment-provider abstraction (apps.shop.payments): "mock" is the only
# registered provider until a real gateway is selected -- see the shop
# decision gate in project docs. Must not be changed to anything else
# without a real PaymentProvider implementation registered first.
SHOP_PAYMENT_PROVIDER = env("SHOP_PAYMENT_PROVIDER", default="mock")

STATIC_URL = env("STATIC_URL", default="/static/")
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = BASE_DIR / "media"

# Applies to every response, including the DEBUG-only media file serving in
# config/urls.py — the one place a MIME-sniffing browser could be tricked
# into executing an uploaded file as HTML/SVG despite the upload validators.
SECURE_CONTENT_TYPE_NOSNIFF = True

DATA_UPLOAD_MAX_MEMORY_SIZE = env.int(
    "DATA_UPLOAD_MAX_MEMORY_SIZE",
    default=10 * 1024 * 1024,
)

FILE_UPLOAD_MAX_MEMORY_SIZE = env.int(
    "FILE_UPLOAD_MAX_MEMORY_SIZE",
    default=5 * 1024 * 1024,
)


STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


CORS_ALLOWED_ORIGINS = csv_env(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CSRF_TRUSTED_ORIGINS = csv_env(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

# The Next.js BFF proxy (frontend/src/app/api/backend/[...path]/route.ts)
# is the only intended reverse proxy in front of this backend. Trusting
# X-Forwarded-Host/-Proto is safe only when a proxy that overwrites (not
# appends) those headers sits directly in front of Django, so it stays
# opt-in rather than a default. Without it, request.build_absolute_uri()
# emits the proxy's internal upstream hostname (e.g. "backend:8000" inside
# Docker) instead of the public host, breaking every generated media URL.
TRUST_PROXY_HEADERS = env.bool("TRUST_PROXY_HEADERS", default=False)
if TRUST_PROXY_HEADERS:
    USE_X_FORWARDED_HOST = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Gates GET /api/health/deep/ (apps.core.views.deep_health_check) --
# operational diagnostics, not a public API. Empty by default, which fails
# the endpoint CLOSED (see _deep_health_authorized): an unconfigured token
# means the endpoint is unreachable by anyone rather than accidentally
# open to the internet. Set to a long random value in any environment
# where deep health actually needs to be polled (e.g. by the future Ops
# Portal or an internal monitoring probe), and send it as the
# X-Internal-Health-Token header.
INTERNAL_HEALTH_TOKEN = env("INTERNAL_HEALTH_TOKEN", default="")

# apps.core.alerting.fire_alert's email channel. Empty by default (no
# alert email sent, only the structured log line) -- see
# docs/reliability/ALERTING.md for exactly what this is and is not.
ALERT_RECIPIENT_EMAIL = env("ALERT_RECIPIENT_EMAIL", default="")


REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",

    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],

    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],

    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "login": "5/min",
        "refresh": "20/min",
        "contact": "5/hour",
        "registration": "3/hour",
        "password_change": "5/hour",
        "set_password": "10/hour",
        "customer_registration": "5/hour",
        "checkout": "20/hour",
        "payment_callback": "60/hour",
    },

    # SimpleRateThrottle.get_ident() trusts the caller-supplied
    # X-Forwarded-For header verbatim as the rate-limit identity whenever
    # NUM_PROXIES is left at its DRF default of None -- so with the
    # backend port reachable directly (docker-compose.prod.yml publishes
    # it with no reverse proxy defined in this repo), any caller can set a
    # fresh X-Forwarded-For value per request and get a fresh throttle
    # bucket every time, completely defeating AnonRateThrottle /
    # ScopedRateThrottle (login brute-force, contact/registration spam,
    # payment-callback abuse, ...). NUM_PROXIES=0 makes get_ident() ignore
    # X-Forwarded-For entirely and always use REMOTE_ADDR, which is exactly
    # right when nothing in front of Django is trusted to have set that
    # header -- the same condition TRUST_PROXY_HEADERS above already
    # gates. Only when TRUST_PROXY_HEADERS is on (a single header-owning
    # reverse proxy confirmed to be in front of Django) do we trust the
    # single rightmost hop of X-Forwarded-For.
    "NUM_PROXIES": 1 if TRUST_PROXY_HEADERS else 0,

    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],

    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 10,

    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],

    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
}


SPECTACULAR_SETTINGS = {
    "TITLE": "Besat School Backend API",
    "DESCRIPTION": "Backend API for Besat school website.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}


ADMIN_URL = env("ADMIN_URL", default="admin/")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# Structured JSON logging -- see docs/reliability/OBSERVABILITY.md.
# Previously: no LOGGING setting existed at all, meaning Django's bare
# implicit default applied (unstructured console output, no redaction,
# no per-request correlation). "besat.request" (one line per HTTP
# request, emitted by apps.core.middleware.RequestLoggingMiddleware) and
# "besat.health" (apps.core.views, the DB-connectivity probe's own
# error logging) are the two loggers currently in active use;
# django.request keeps Django's own request-level error reporting
# flowing through the same JSON formatter instead of its default
# plain-text one, so a real backend exception is still visible in
# server logs even though apps.core.views deliberately never returns
# it in an HTTP response body.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "apps.core.logging_utils.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "besat": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
    
