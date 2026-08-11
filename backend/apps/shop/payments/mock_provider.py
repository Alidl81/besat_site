"""A clearly-labeled, obviously-fake payment provider for development and
testing. It cannot be mistaken for a real gateway: the redirect page it
sends buyers to is an in-app Next.js page (/shop/payment/mock/<id>/) that
says outright it is a test gateway, with explicit "pay" and "fail"
buttons -- no bank branding, no card-entry form.

Despite being fake, it follows the exact discipline a real integration
needs: the amount/currency verified at callback time always comes from
the PaymentAttempt row the server already holds, never from the
callback's own request body, and the callback is rejected unless it
carries a token this server itself signed for this specific attempt."""

from __future__ import annotations

import hashlib
import hmac
from urllib.parse import quote

from django.conf import settings

from .base import PaymentIntent, PaymentProvider, PaymentVerificationResult


def _sign_mock_token(attempt) -> str:
    message = f"{attempt.pk}:{attempt.idempotency_key}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


class MockPaymentProvider(PaymentProvider):
    name = "mock"

    def start_payment(self, *, attempt, return_url: str) -> PaymentIntent:
        token = _sign_mock_token(attempt)
        frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
        redirect_url = (
            f"{frontend_base}/shop/payment/mock/{attempt.pk}/"
            f"?token={token}&return_url={quote(return_url, safe='')}"
        )
        provider_reference = f"MOCK-{attempt.idempotency_key}"

        return PaymentIntent(
            attempt_id=attempt.pk,
            order_id=attempt.order_id,
            amount=attempt.amount_amount,
            currency=attempt.currency_code,
            redirect_url=redirect_url,
            provider_reference=provider_reference,
        )

    def verify_callback(self, *, request_data: dict) -> PaymentVerificationResult:
        # Local import: apps/shop/models imports this payments package
        # indirectly (via services), so importing PaymentAttempt at module
        # load time here would risk a circular import during app loading.
        from apps.shop.models import PaymentAttempt

        attempt_id = request_data.get("attempt_id")
        outcome = request_data.get("outcome")
        provided_token = request_data.get("mock_token")

        try:
            attempt = PaymentAttempt.objects.get(pk=attempt_id, provider=self.name)
        except (PaymentAttempt.DoesNotExist, ValueError, TypeError):
            return PaymentVerificationResult(
                success=False,
                provider_reference=None,
                verified_amount=None,
                verified_currency=None,
                raw_payload=request_data,
                failure_reason="attempt_not_found",
            )

        expected_token = _sign_mock_token(attempt)
        if not provided_token or not hmac.compare_digest(expected_token, str(provided_token)):
            return PaymentVerificationResult(
                success=False,
                provider_reference=None,
                verified_amount=None,
                verified_currency=None,
                raw_payload=request_data,
                failure_reason="invalid_signature",
            )

        provider_reference = attempt.provider_reference or f"MOCK-{attempt.idempotency_key}"

        if outcome == "success":
            return PaymentVerificationResult(
                success=True,
                provider_reference=provider_reference,
                verified_amount=attempt.amount_amount,
                verified_currency=attempt.currency_code,
                raw_payload=request_data,
                failure_reason=None,
            )

        return PaymentVerificationResult(
            success=False,
            provider_reference=provider_reference,
            verified_amount=attempt.amount_amount,
            verified_currency=attempt.currency_code,
            raw_payload=request_data,
            failure_reason=outcome or "unknown",
        )
