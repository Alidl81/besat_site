"""Payment-provider abstraction. Checkout/payment views and services talk
only to this interface, never to a specific gateway's SDK -- so wiring in
a real provider later (Zarinpal, IDPay, ...) means writing one new class
here, not touching checkout logic. No real provider is implemented yet;
`MockPaymentProvider` (mock_provider.py) is the only one registered until
the product owner picks a real gateway (see project decision gate)."""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class PaymentIntent:
    """Returned by start_payment(): where to send the customer next."""

    attempt_id: int
    order_id: int
    amount: int
    currency: str
    redirect_url: str
    provider_reference: str | None


@dataclass(frozen=True)
class PaymentVerificationResult:
    """Returned by verify_callback(). `verified_amount`/`verified_currency`
    must come from data the PROVIDER (or, for the mock provider, the
    signed token) attests to -- never copied verbatim from unverified
    request input -- so callers can safely compare them against the
    order's own recorded total without re-trusting the client."""

    success: bool
    provider_reference: str | None
    verified_amount: int | None
    verified_currency: str | None
    raw_payload: dict
    failure_reason: str | None = None


class PaymentProvider(abc.ABC):
    name: str

    @abc.abstractmethod
    def start_payment(self, *, attempt, return_url: str) -> PaymentIntent:
        """Begin a payment attempt, returning where to redirect the buyer."""
        raise NotImplementedError

    @abc.abstractmethod
    def verify_callback(self, *, request_data: dict) -> PaymentVerificationResult:
        """Verify a gateway callback/return. Must independently confirm
        the payload against server-held state (a signature, a stored
        attempt reference, ...) rather than trusting any field the
        request supplies at face value."""
        raise NotImplementedError
