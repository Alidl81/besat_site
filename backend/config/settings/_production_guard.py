"""Fail-closed validation for config.settings.production.

Pure functions -- no Django settings/env access -- so they can be unit
tested directly (backend/config/settings/test_production_guard.py) without
needing to reload Django's settings module machinery. Called once, with
already-resolved values, from the bottom of config/settings/production.py,
so it runs for every process that imports production settings (gunicorn,
`manage.py migrate`, `manage.py check`, a shell, ...) -- not just ones that
happen to invoke `manage.py check --deploy`.
"""

from django.core.exceptions import ImproperlyConfigured

MIN_SECRET_KEY_LENGTH = 32

# Substrings (case-insensitive) that appear in every placeholder value this
# codebase's own example env files use. Deliberately a denylist of known
# examples rather than a cleverer heuristic -- a false negative here just
# means "didn't catch a novel placeholder", which is no worse than not
# having this check at all; a false positive would block a legitimate
# deploy, which is worse than under-catching.
PLACEHOLDER_MARKERS = (
    "change-me",
    "changeme",
    "replace-me",
    "your-secret",
    "your-domain",
    "example.com",
    "unsafe-development-key",
    "local-development-secret",
    "dev-only",
)


def is_placeholder_value(value: str) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def validate_production_settings(
    *,
    debug: bool,
    secret_key: str,
    allowed_hosts: list[str],
    cors_allowed_origins: list[str],
    csrf_trusted_origins: list[str],
    session_cookie_secure: bool,
    csrf_cookie_secure: bool,
    database_engine: str | None = None,
    shop_payment_provider: str | None = None,
) -> None:
    """Raise ImproperlyConfigured (refusing to start) if any of these are
    in a state that must never be true for a production deployment.
    Deliberately checks the *resolved* values (what Django will actually
    use), not the raw env vars -- catches a bad default reintroduced
    upstream just as well as a bad value supplied directly."""
    errors = []

    if debug:
        errors.append("DEBUG must be False in production.")

    if not secret_key or len(secret_key) < MIN_SECRET_KEY_LENGTH:
        errors.append(
            f"SECRET_KEY must be set and at least {MIN_SECRET_KEY_LENGTH} "
            "characters long."
        )
    elif is_placeholder_value(secret_key):
        errors.append(
            "SECRET_KEY looks like a placeholder value copied from an "
            "example env file -- generate a real random secret."
        )

    if not allowed_hosts:
        errors.append("ALLOWED_HOSTS must not be empty in production.")
    elif "*" in allowed_hosts:
        errors.append("ALLOWED_HOSTS must not contain the '*' wildcard in production.")

    if not cors_allowed_origins:
        errors.append("CORS_ALLOWED_ORIGINS must not be empty in production.")

    if not csrf_trusted_origins:
        errors.append("CSRF_TRUSTED_ORIGINS must not be empty in production.")

    if not session_cookie_secure:
        errors.append("SESSION_COOKIE_SECURE must be True in production.")

    if not csrf_cookie_secure:
        errors.append("CSRF_COOKIE_SECURE must be True in production.")

    if database_engine is not None and "sqlite" in database_engine:
        errors.append(
            "DATABASE_URL resolved to SQLite in production -- "
            "config/settings/base.py silently falls back to a local "
            "sqlite3 file (inside the container's own ephemeral "
            "filesystem, not a mounted volume) when DATABASE_URL is "
            "missing/unset, which would lose all data on every restart. "
            "Set DATABASE_URL to a real PostgreSQL connection string."
        )

    if shop_payment_provider == "mock":
        errors.append(
            "SHOP_PAYMENT_PROVIDER=mock in production -- the mock provider's "
            "AllowAny callback endpoint accepts a caller-supplied "
            "outcome=success directly (see apps/shop/payments/mock_provider.py), "
            "letting anyone mark their own order paid without a real "
            "payment. Register and select a real PaymentProvider before "
            "deploying, or accept this is a demo/staging deployment "
            "explicitly (there is currently no override for this check -- "
            "if that's a deliberate choice, that decision needs to be made "
            "at the code level, not bypassed silently here)."
        )

    if errors:
        raise ImproperlyConfigured(
            "Refusing to start with an unsafe production configuration:\n- "
            + "\n- ".join(errors)
        )
