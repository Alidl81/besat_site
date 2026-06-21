from .base import *  # noqa: F403


DEBUG = env.bool("DEBUG", default=True)  # noqa: F405

ALLOWED_HOSTS = csv_env(  # noqa: F405
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1",
)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

INTERNAL_IPS = [
    "127.0.0.1",
]