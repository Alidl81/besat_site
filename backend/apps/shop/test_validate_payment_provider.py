"""Tests for `manage.py validate_payment_provider` (SEC-CONFIG-001 follow-up:
the production settings guard can reject a known-unsafe value like "mock",
but can't safely import apps.shop.payments.registry itself at settings-
import time -- this command is the real, always-run check that a
misconfigured SHOP_PAYMENT_PROVIDER fails the deploy loudly instead of
surfacing as an uncaught 500 the first time a customer starts checkout)."""

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings


class ValidatePaymentProviderTests(TestCase):
    @override_settings(SHOP_PAYMENT_PROVIDER="mock")
    def test_a_registered_provider_passes(self):
        call_command("validate_payment_provider")  # must not raise

    @override_settings(SHOP_PAYMENT_PROVIDER="a-typo-or-unimplemented-gateway")
    def test_an_unregistered_provider_fails_loudly(self):
        with self.assertRaises(CommandError):
            call_command("validate_payment_provider")
