from django.conf import settings

from .base import PaymentProvider
from .mock_provider import MockPaymentProvider

# Only "mock" is registered. Adding a real gateway later is an isolated,
# additive change: implement PaymentProvider in a new module and register
# it here -- checkout/payment views never change.
PROVIDERS: dict[str, type[PaymentProvider]] = {
    "mock": MockPaymentProvider,
}


def get_payment_provider(name: str | None = None) -> PaymentProvider:
    provider_name = name or getattr(settings, "SHOP_PAYMENT_PROVIDER", "mock")

    try:
        provider_cls = PROVIDERS[provider_name]
    except KeyError as exc:
        raise ValueError(f"درگاه پرداخت «{provider_name}» ثبت نشده است.") from exc

    return provider_cls()
