"""Unit tests for the fail-closed production settings guard (SEC-CONFIG-001).

Pure-function tests -- no Django settings reload needed, no database.
"""

import os
import subprocess
import sys

from django.conf import settings as django_settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from ._production_guard import (
    is_placeholder_value,
    validate_production_settings,
    validate_public_origin,
)

VALID_KWARGS = {
    "debug": False,
    "secret_key": "a" * 50,
    "allowed_hosts": ["besat.org", "www.besat.org"],
    "cors_allowed_origins": ["https://besat.org"],
    "csrf_trusted_origins": ["https://besat.org"],
    "session_cookie_secure": True,
    "csrf_cookie_secure": True,
    "database_engine": "django.db.backends.postgresql",
    "frontend_base_url": "https://besat.org",
}


class IsPlaceholderValueTests(SimpleTestCase):
    def test_known_placeholders_from_example_env_files_are_detected(self):
        self.assertTrue(is_placeholder_value("change-me-use-a-long-random-secret"))
        self.assertTrue(is_placeholder_value("change-me-database-password"))
        self.assertTrue(is_placeholder_value("change-me-local-dev-only"))
        self.assertTrue(is_placeholder_value("unsafe-development-key-change-me"))
        self.assertTrue(is_placeholder_value(""))

    def test_a_real_looking_random_secret_is_not_flagged(self):
        self.assertFalse(is_placeholder_value("k3f9-2xQ!7mZpL8vR-random-generated-secret-9284"))

    def test_public_origin_accepts_the_canonical_https_origin(self):
        self.assertIsNone(validate_public_origin("https://besat.org"))

    def test_public_origin_rejects_http_loopback_and_placeholder_values(self):
        self.assertIsNotNone(validate_public_origin("http://localhost:3000"))
        self.assertIsNotNone(validate_public_origin("https://127.0.0.1"))
        self.assertIsNotNone(validate_public_origin("https://your-domain.example"))
        self.assertIsNotNone(validate_public_origin("https://besat.org:not-a-port"))


class ValidateProductionSettingsTests(SimpleTestCase):
    def test_a_fully_valid_configuration_raises_nothing(self):
        validate_production_settings(**VALID_KWARGS)  # must not raise

    def test_debug_true_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "debug": True})

    def test_missing_secret_key_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "secret_key": ""})

    def test_short_secret_key_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "secret_key": "short"})

    def test_placeholder_secret_key_is_rejected_even_if_long_enough(self):
        placeholder = "change-me-use-a-long-random-secret-padding-padding"
        self.assertGreaterEqual(len(placeholder), 32)
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "secret_key": placeholder})

    def test_empty_allowed_hosts_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "allowed_hosts": []})

    def test_wildcard_allowed_hosts_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "allowed_hosts": ["*"]})

    def test_empty_cors_allowed_origins_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "cors_allowed_origins": []})

    def test_empty_csrf_trusted_origins_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "csrf_trusted_origins": []})

    def test_insecure_session_cookie_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "session_cookie_secure": False})

    def test_insecure_csrf_cookie_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            validate_production_settings(**{**VALID_KWARGS, "csrf_cookie_secure": False})

    def test_sqlite_database_engine_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            validate_production_settings(
                **{**VALID_KWARGS, "database_engine": "django.db.backends.sqlite3"}
            )
        self.assertIn("DATABASE_URL", str(ctx.exception))

    def test_postgresql_database_engine_is_not_rejected(self):
        validate_production_settings(
            **{**VALID_KWARGS, "database_engine": "django.db.backends.postgresql"}
        )

    def test_omitted_database_engine_does_not_raise(self):
        kwargs = {k: v for k, v in VALID_KWARGS.items() if k != "database_engine"}
        validate_production_settings(**kwargs)

    def test_mock_payment_provider_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            validate_production_settings(**{**VALID_KWARGS, "shop_payment_provider": "mock"})
        self.assertIn("SHOP_PAYMENT_PROVIDER", str(ctx.exception))

    def test_a_real_payment_provider_name_is_not_rejected(self):
        validate_production_settings(**{**VALID_KWARGS, "shop_payment_provider": "some-real-gateway"})

    def test_omitted_payment_provider_does_not_raise(self):
        # Optional parameter -- callers that don't pass it (or future ones
        # not yet updated) aren't newly broken by this check.
        validate_production_settings(**VALID_KWARGS)

    def test_multiple_violations_are_all_reported_together(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            validate_production_settings(
                **{**VALID_KWARGS, "debug": True, "secret_key": "", "allowed_hosts": []}
            )
        message = str(ctx.exception)
        self.assertIn("DEBUG", message)
        self.assertIn("SECRET_KEY", message)
        self.assertIn("ALLOWED_HOSTS", message)


class RealProductionModuleFailClosedTests(SimpleTestCase):
    """Proves the guard is actually wired into the real
    config.settings.production module end-to-end, not just correct in
    isolation -- reloading Django settings mid-test-run is unreliable
    in-process, so these spawn a real `manage.py check` subprocess against
    production settings with deliberately broken env, in an isolated
    disposable process (never touches any database)."""

    def _run_manage_check(self, env_overrides: dict[str, str]) -> subprocess.CompletedProcess:
        manage_py = os.path.join(django_settings.BASE_DIR, "manage.py")
        env = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "config.settings.production",
            "DJANGO_READ_DOT_ENV_FILE": "False",
            # A fully valid baseline, so each test overrides exactly one
            # thing and we know any failure is caused by that override.
            "SECRET_KEY": "a-sufficiently-long-random-production-secret-value-123456",
            "ALLOWED_HOSTS": "besat.org,www.besat.org",
            "CORS_ALLOWED_ORIGINS": "https://besat.org",
            "CSRF_TRUSTED_ORIGINS": "https://besat.org",
            "FRONTEND_BASE_URL": "https://besat.org",
            # Syntactically valid PostgreSQL URL -- `manage.py check` only
            # parses this into DATABASES, it never opens a real connection,
            # so this doesn't need a reachable database.
            "DATABASE_URL": "postgres://user:pw@db-host:5432/dbname",
            "SHOP_PAYMENT_PROVIDER": "a-real-gateway-not-mock",
            **env_overrides,
        }
        return subprocess.run(
            [sys.executable, manage_py, "check"],
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_valid_production_env_passes(self):
        result = self._run_manage_check({})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_debug_env_var_cannot_turn_on_debug_in_production(self):
        # production.py hardcodes DEBUG = False rather than reading it from
        # the environment at all -- stronger than "validated but
        # overridable". This proves that property directly: even an
        # explicit DEBUG=True in the environment has no effect and the
        # process starts clean (still DEBUG=False under the hood). The
        # guard's own `debug` check (see ValidateProductionSettingsTests)
        # exists as regression protection in case that ever changes.
        result = self._run_manage_check({"DEBUG": "True"})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_secret_key_refuses_to_start(self):
        result = self._run_manage_check({"SECRET_KEY": ""})
        self.assertNotEqual(result.returncode, 0)

    def test_placeholder_secret_key_refuses_to_start(self):
        result = self._run_manage_check(
            {"SECRET_KEY": "change-me-use-a-long-random-secret-padding-padding"}
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("placeholder", result.stderr)

    def test_empty_allowed_hosts_refuses_to_start(self):
        result = self._run_manage_check({"ALLOWED_HOSTS": ""})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ALLOWED_HOSTS", result.stderr)

    def test_mock_payment_provider_refuses_to_start(self):
        result = self._run_manage_check({"SHOP_PAYMENT_PROVIDER": "mock"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SHOP_PAYMENT_PROVIDER", result.stderr)

    def test_missing_database_url_refuses_to_start(self):
        # _run_manage_check always sets a baseline DATABASE_URL, so build
        # this one directly instead of through the helper's override dict
        # (there is no way to *unset* a key via a dict merge).
        manage_py = os.path.join(django_settings.BASE_DIR, "manage.py")
        base_env = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "config.settings.production",
            "DJANGO_READ_DOT_ENV_FILE": "False",
            "SECRET_KEY": "a-sufficiently-long-random-production-secret-value-123456",
            "ALLOWED_HOSTS": "besat.org,www.besat.org",
            "CORS_ALLOWED_ORIGINS": "https://besat.org",
            "CSRF_TRUSTED_ORIGINS": "https://besat.org",
            "FRONTEND_BASE_URL": "https://besat.org",
            "SHOP_PAYMENT_PROVIDER": "a-real-gateway-not-mock",
        }
        base_env.pop("DATABASE_URL", None)
        result = subprocess.run(
            [sys.executable, manage_py, "check"],
            env=base_env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_URL", result.stderr)
