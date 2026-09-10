from .base import *  # noqa: F403

DEBUG = False

SECRET_KEY = env("SECRET_KEY")  # noqa: F405

ALLOWED_HOSTS = csv_env("ALLOWED_HOSTS")  # noqa: F405
CSRF_TRUSTED_ORIGINS = csv_env("CSRF_TRUSTED_ORIGINS")  # noqa: F405
CORS_ALLOWED_ORIGINS = csv_env("CORS_ALLOWED_ORIGINS")  # noqa: F405

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)  # noqa: F405
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)  # noqa: F405
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=True)  # noqa: F405

X_FRAME_OPTIONS = "DENY"

from ._production_guard import validate_production_settings  # noqa: E402

validate_production_settings(
    debug=DEBUG,
    secret_key=SECRET_KEY,
    allowed_hosts=ALLOWED_HOSTS,
    cors_allowed_origins=CORS_ALLOWED_ORIGINS,
    csrf_trusted_origins=CSRF_TRUSTED_ORIGINS,
    session_cookie_secure=SESSION_COOKIE_SECURE,
    csrf_cookie_secure=CSRF_COOKIE_SECURE,
    database_engine=DATABASES["default"].get("ENGINE"),
    shop_payment_provider=SHOP_PAYMENT_PROVIDER,
)
