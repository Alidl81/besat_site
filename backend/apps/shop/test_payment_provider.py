from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.shop.models import Order, PaymentAttempt
from apps.shop.payments import get_payment_provider
from apps.shop.payments.mock_provider import MockPaymentProvider

User = get_user_model()


class MockPaymentProviderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="buyer", password="x")
        self.order = Order.objects.create(user=self.user, total_amount=150_000)
        self.attempt = PaymentAttempt.objects.create(
            order=self.order,
            provider="mock",
            amount_amount=150_000,
            idempotency_key="test-key-1",
            initiated_by=self.user,
        )
        self.provider = MockPaymentProvider()

    def test_registry_returns_mock_provider_by_default(self):
        self.assertIsInstance(get_payment_provider(), MockPaymentProvider)

    def test_start_payment_returns_redirect_with_signed_token(self):
        intent = self.provider.start_payment(attempt=self.attempt, return_url="https://example.test/return")

        self.assertEqual(intent.attempt_id, self.attempt.pk)
        self.assertEqual(intent.amount, 150_000)
        self.assertIn(f"/shop/payment/mock/{self.attempt.pk}/", intent.redirect_url)
        self.assertIn("token=", intent.redirect_url)

    def test_verify_callback_succeeds_with_valid_token_and_amount_comes_from_attempt(self):
        intent = self.provider.start_payment(attempt=self.attempt, return_url="https://example.test/return")
        token = intent.redirect_url.split("token=")[1].split("&")[0]

        result = self.provider.verify_callback(
            request_data={"attempt_id": self.attempt.pk, "outcome": "success", "mock_token": token}
        )

        self.assertTrue(result.success)
        # The verified amount must come from the server-held attempt row,
        # never from anything the caller supplied in request_data.
        self.assertEqual(result.verified_amount, self.attempt.amount_amount)
        self.assertEqual(result.verified_currency, self.attempt.currency_code)

    def test_verify_callback_rejects_tampered_token(self):
        result = self.provider.verify_callback(
            request_data={
                "attempt_id": self.attempt.pk,
                "outcome": "success",
                "mock_token": "not-a-real-token",
            }
        )

        self.assertFalse(result.success)
        self.assertEqual(result.failure_reason, "invalid_signature")

    def test_verify_callback_rejects_unknown_attempt(self):
        result = self.provider.verify_callback(
            request_data={"attempt_id": 999_999, "outcome": "success", "mock_token": "whatever"}
        )

        self.assertFalse(result.success)
        self.assertEqual(result.failure_reason, "attempt_not_found")

    def test_verify_callback_reports_failure_outcome(self):
        intent = self.provider.start_payment(attempt=self.attempt, return_url="https://example.test/return")
        token = intent.redirect_url.split("token=")[1].split("&")[0]

        result = self.provider.verify_callback(
            request_data={"attempt_id": self.attempt.pk, "outcome": "failure", "mock_token": token}
        )

        self.assertFalse(result.success)
        self.assertEqual(result.failure_reason, "failure")
        # Even on failure, the amount is still reported from server state
        # (useful for logging/audit), it just doesn't imply success.
        self.assertEqual(result.verified_amount, self.attempt.amount_amount)
