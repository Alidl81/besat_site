"""Tests for `manage.py ensure_cms_admin` (SEC-CONFIG-001 acceptance
criteria #9 and #10: never a default admin credential, never a silent
password reset on a normal production restart).
"""

import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserProfile

User = get_user_model()

ENV_VARS = ("CMS_ADMIN_USERNAME", "CMS_ADMIN_PASSWORD", "CMS_ADMIN_EMAIL", "CMS_ADMIN_FORCE_RESET")


class EnsureCmsAdminTests(TestCase):
    def setUp(self):
        patcher = mock.patch.dict(os.environ, {}, clear=False)
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in ENV_VARS:
            os.environ.pop(name, None)

    def _set_env(self, **kwargs):
        for key, value in kwargs.items():
            os.environ[key] = value

    def test_skips_entirely_when_no_credentials_set(self):
        call_command("ensure_cms_admin")
        self.assertFalse(User.objects.exists())

    def test_requires_both_username_and_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin")
        with self.assertRaises(CommandError):
            call_command("ensure_cms_admin")

    @override_settings(DEBUG=False)
    def test_production_rejects_a_placeholder_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="change-me-local-dev-only")
        with self.assertRaises(CommandError):
            call_command("ensure_cms_admin")
        self.assertFalse(User.objects.exists())

    @override_settings(DEBUG=True)
    def test_dev_allows_a_placeholder_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="change-me-local-dev-only")
        call_command("ensure_cms_admin")
        self.assertTrue(User.objects.filter(username="admin").exists())

    @override_settings(DEBUG=False)
    def test_first_bootstrap_creates_the_admin_with_the_given_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="a-real-strong-random-password-123")
        call_command("ensure_cms_admin")

        user = User.objects.get(username="admin")
        self.assertTrue(user.check_password("a-real-strong-random-password-123"))
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.role, UserProfile.Role.GENERAL_MANAGER)

    @override_settings(DEBUG=False)
    def test_normal_production_restart_does_not_reset_an_existing_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        user = User.objects.get(username="admin")
        user.set_password("password-the-admin-changed-by-hand-in-the-ui")
        user.save()

        # Simulate a routine redeploy: same env vars still set (a secrets
        # manager or compose env_file wouldn't know to unset them).
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        user.refresh_from_db()
        self.assertTrue(
            user.check_password("password-the-admin-changed-by-hand-in-the-ui"),
            "A normal production restart overwrote an existing admin's manually-changed password.",
        )

    @override_settings(DEBUG=False)
    def test_force_reset_flag_does_reset_an_existing_password(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        self._set_env(
            CMS_ADMIN_USERNAME="admin",
            CMS_ADMIN_PASSWORD="second-real-strong-password-456",
            CMS_ADMIN_FORCE_RESET="1",
        )
        call_command("ensure_cms_admin")

        user = User.objects.get(username="admin")
        self.assertTrue(user.check_password("second-real-strong-password-456"))

    @override_settings(DEBUG=False)
    def test_force_reset_revokes_the_admins_outstanding_sessions(self):
        # AUTH-001 follow-up: forcing a reset is exactly the "recover a
        # compromised admin account" scenario -- a session an attacker
        # already holds must not survive it.
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")
        admin = User.objects.get(username="admin")
        pre_reset_token = RefreshToken.for_user(admin)

        self._set_env(
            CMS_ADMIN_USERNAME="admin",
            CMS_ADMIN_PASSWORD="second-real-strong-password-456",
            CMS_ADMIN_FORCE_RESET="1",
        )
        call_command("ensure_cms_admin")

        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=pre_reset_token["jti"]).exists(),
            "A force-reset of the CMS administrator did not revoke a pre-existing session.",
        )

    @override_settings(DEBUG=True)
    def test_dev_mode_does_reset_an_existing_password_without_the_force_flag(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="second-real-strong-password-456")
        call_command("ensure_cms_admin")

        user = User.objects.get(username="admin")
        self.assertTrue(user.check_password("second-real-strong-password-456"))

    @override_settings(DEBUG=False)
    def test_role_stays_correct_on_a_skipped_reset(self):
        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        user = User.objects.get(username="admin")
        profile = UserProfile.objects.get(user=user)
        profile.role = UserProfile.Role.PARENT
        profile.save()

        self._set_env(CMS_ADMIN_USERNAME="admin", CMS_ADMIN_PASSWORD="first-real-strong-password-123")
        call_command("ensure_cms_admin")

        profile.refresh_from_db()
        self.assertEqual(
            profile.role,
            UserProfile.Role.GENERAL_MANAGER,
            "Role/staff/superuser flags should still be corrected even when the password reset is skipped.",
        )
