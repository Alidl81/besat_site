from .base import *  # noqa: F403


DEBUG = env.bool("DEBUG", default=True)  # noqa: F405

# Matches frontend/next.config.ts's allowedDevOrigins so the same verified
# LAN workstations can reach the API directly during development. This is a
# local-only default and is never used by config.settings.production, which
# requires ALLOWED_HOSTS/CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS from env.
_LAN_DEV_HOSTS = "192.168.10.65,192.168.10.71"

ALLOWED_HOSTS = csv_env(  # noqa: F405
    "ALLOWED_HOSTS",
    f"localhost,127.0.0.1,{_LAN_DEV_HOSTS}",
)
CORS_ALLOWED_ORIGINS = csv_env(  # noqa: F405
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,"
    + ",".join(f"http://{host}:3000" for host in _LAN_DEV_HOSTS.split(",")),
)
CSRF_TRUSTED_ORIGINS = csv_env(  # noqa: F405
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,"
    + ",".join(f"http://{host}:3000" for host in _LAN_DEV_HOSTS.split(",")),
)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

INTERNAL_IPS = [
    "127.0.0.1",
]