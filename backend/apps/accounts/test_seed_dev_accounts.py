"""Tests for `manage.py seed_dev_accounts` (SEC-CONFIG-001: this command
must never be able to run against a production-configured deployment)."""

import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

User = get_user_model()

ENV_VARS = ("DEV_ADMIN_PASSWORD", "DEV_MEDIA_PASSWORD", "DEV_UNIT_MANAGER_PASSWORD", "DEV_PARENT_PASSWORD")


class SeedDevAccountsTests(TestCase):
    def setUp(self):
        patcher = mock.patch.dict(os.environ, {}, clear=False)
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in ENV_VARS:
            os.environ.pop(name, None)

    @override_settings(DEBUG=False)
    def test_refuses_to_run_when_debug_is_false(self):
        os.environ.update(
            DEV_ADMIN_PASSWORD="x", DEV_MEDIA_PASSWORD="x", DEV_UNIT_MANAGER_PASSWORD="x", DEV_PARENT_PASSWORD="x"
        )
        with self.assertRaises(CommandError):
            call_command("seed_dev_accounts")
        self.assertFalse(User.objects.filter(username="dev_admin").exists())

    @override_settings(DEBUG=True)
    def test_refuses_to_run_when_a_password_env_var_is_missing_even_in_dev(self):
        os.environ.update(DEV_ADMIN_PASSWORD="x")
        with self.assertRaises(CommandError):
            call_command("seed_dev_accounts")

    @override_settings(DEBUG=True)
    def test_creates_the_three_role_accounts_in_dev(self):
        os.environ.update(
            DEV_ADMIN_PASSWORD="DevAdminPw1",
            DEV_MEDIA_PASSWORD="DevMediaPw1",
            DEV_UNIT_MANAGER_PASSWORD="DevUnitManagerPw1",
            DEV_PARENT_PASSWORD="DevParentPw1",
        )
        call_command("seed_dev_accounts")

        self.assertTrue(User.objects.filter(username="dev_admin").exists())
        self.assertTrue(User.objects.filter(username="dev_media").exists())
        self.assertTrue(User.objects.filter(username="dev_unit_manager").exists())
        self.assertTrue(User.objects.filter(username="dev_parent").exists())
