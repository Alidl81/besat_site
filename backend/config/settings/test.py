# Not selected automatically -- the backend container's DJANGO_SETTINGS_MODULE
# defaults to config.settings.local (see docker-compose.yml), so running
# `manage.py test` without an explicit override uses LOCAL settings' REAL
# throttle rates (login: 5/min, payment_callback: 60/hour, etc. -- see
# config/settings/base.py), not this file's intentionally-disabled ones.
# Under local settings, a full-suite run's cumulative login()/checkout()/
# payment-callback calls exhaust those shared-LocMemCache quotas well
# before the suite finishes, producing a long tail of unrelated-looking
# 429 failures that have nothing to do with the code under test --
# confirmed directly this session: the exact same full suite went from
# 24-26 failing tests (under config.settings.local, ~150s) to 0 failing
# tests (under this file, ~15s) with zero source changes in between.
# Always run tests explicitly as:
#   DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test
from .local import *  # noqa: F403, F401


PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
ENABLE_API_DOCS = True

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {},
}
