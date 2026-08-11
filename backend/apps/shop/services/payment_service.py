"""Payment start + callback verification. `handle_payment_callback` is
the other concurrency-critical function in this app: it holds a row lock
on the order for its whole duration, rejects a callback that has already
been successfully verified once (DB-enforced replay guard) before doing
anything else, and only ever trusts the amount/currency the payment
provider itself attests to (never anything the callback's own request
body claims) when deciding whether the order is really paid."""

from __future__ import annotations

import secrets

from django.db import transaction

from ..models import (
    InPersonCourseDetail,
    OnlineCourseDetail,
    Order,
    OrderEvent,
    PaymentAttempt,
    PaymentTransaction,
    PhysicalProductDetail,
    Product,
    ProductVariant,
    StockReservation,
)
from ..payments import get_payment_provider
from .course_service import grant_course_entitlements
from .order_service import record_order_event, transition_order_status


class PaymentError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


_SENSITIVE_PAYLOAD_KEY_MARKERS = ("secret", "password", "card_number", "cvv", "pan")


def _scrub_payload(payload: dict) -> dict:
    """Defense in depth: strip any key that looks like it could carry a
    secret before persisting a callback payload, even though today's mock
    provider never sends one (its `mock_token` is a derived signature, not
    a credential, and is intentionally left visible for audit)."""
    return {
        key: ("***redacted***" if any(marker in key.lower() for marker in _SENSITIVE_PAYLOAD_KEY_MARKERS) else value)
        for key, value in payload.items()
    }


@transaction.atomic
def start_payment(order: Order, *, actor, return_url: str) -> tuple[PaymentAttempt, "PaymentIntent"]:
    locked_order = Order.objects.select_for_update().get(pk=order.pk)

    if locked_order.status not in (Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_FAILED):
        raise PaymentError(
            "invalid_order_status", "این سفارش در وضعیتی نیست که بتوان برای آن پرداخت شروع کرد."
        )

    provider = get_payment_provider()

    attempt = PaymentAttempt.objects.create(
        order=locked_order,
        provider=provider.name,
        amount_amount=locked_order.total_amount,
        currency_code=locked_order.currency_code,
        idempotency_key=secrets.token_hex(16),
        initiated_by=actor,
        status=PaymentAttempt.Status.INITIATED,
    )

    intent = provider.start_payment(attempt=attempt, return_url=return_url)

    attempt.provider_reference = intent.provider_reference
    attempt.status = PaymentAttempt.Status.REDIRECTED
    attempt.save(update_fields=["provider_reference", "status", "updated_at"])

    if locked_order.status == Order.Status.PAYMENT_FAILED:
        transition_order_status(locked_order, Order.Status.PENDING_PAYMENT, actor=actor, reason="تلاش مجدد پرداخت")
    transition_order_status(locked_order, Order.Status.PAYMENT_PROCESSING, actor=actor, reason="شروع پرداخت")

    return attempt, intent


def _apply_inventory_on_payment_success(order: Order) -> None:
    for order_item in order.items.select_related("product", "variant").all():
        reservation = StockReservation.objects.filter(
            order_item=order_item, status=StockReservation.Status.ACTIVE
        ).first()
        if reservation is not None:
            reservation.status = StockReservation.Status.CONSUMED
            reservation.save(update_fields=["status", "updated_at"])

        product = order_item.product
        if product is None:
            continue

        if product.product_type == Product.ProductType.PHYSICAL:
            if order_item.variant_id:
                variant = ProductVariant.objects.select_for_update().get(pk=order_item.variant_id)
                variant.inventory_qty = max(variant.inventory_qty - order_item.quantity, 0)
                variant.save(update_fields=["inventory_qty", "updated_at"])
            else:
                detail = PhysicalProductDetail.objects.select_for_update().get(pk=product.pk)
                detail.inventory_qty = max(detail.inventory_qty - order_item.quantity, 0)
                detail.recompute_availability(commit=False)
                detail.save()
            record_order_event(
                order, OrderEvent.EventType.INVENTORY_CHANGE, message=f"موجودی «{product.title}» کاهش یافت."
            )
        elif product.product_type == Product.ProductType.ONLINE_COURSE:
            detail = OnlineCourseDetail.objects.select_for_update().get(pk=product.pk)
            detail.enrolled_count += order_item.quantity
            detail.recompute_enrollment_status(commit=False)
            detail.save()
        elif product.product_type == Product.ProductType.IN_PERSON_COURSE:
            detail = InPersonCourseDetail.objects.select_for_update().get(pk=product.pk)
            detail.enrolled_count += order_item.quantity
            detail.recompute_enrollment_status(commit=False)
            detail.save()


@transaction.atomic
def handle_payment_callback(provider_name: str, request_data: dict) -> dict:
    """Returns {"order": Order, "attempt": PaymentAttempt|None, "outcome": str}.
    outcome is one of: success, failed, amount_mismatch, duplicate, attempt_not_found."""
    provider = get_payment_provider(provider_name)

    attempt_id = request_data.get("attempt_id")
    try:
        attempt = PaymentAttempt.objects.select_for_update().get(pk=attempt_id, provider=provider_name)
    except (PaymentAttempt.DoesNotExist, ValueError, TypeError):
        return {"order": None, "attempt": None, "outcome": "attempt_not_found"}

    order = Order.objects.select_for_update().get(pk=attempt.order_id)

    already_succeeded = PaymentTransaction.objects.filter(
        attempt=attempt, transaction_type=PaymentTransaction.TransactionType.VERIFICATION_SUCCEEDED
    ).exists()
    if already_succeeded:
        PaymentTransaction.objects.create(
            attempt=attempt,
            transaction_type=PaymentTransaction.TransactionType.DUPLICATE_CALLBACK_REJECTED,
            raw_payload=_scrub_payload(request_data),
            result=PaymentTransaction.Result.REPLAY_REJECTED,
        )
        return {"order": order, "attempt": attempt, "outcome": "duplicate"}

    result = provider.verify_callback(request_data=request_data)

    if not result.success:
        PaymentTransaction.objects.create(
            attempt=attempt,
            transaction_type=PaymentTransaction.TransactionType.VERIFICATION_FAILED,
            provider_reference=result.provider_reference,
            raw_payload=_scrub_payload(result.raw_payload),
            verified_amount_amount=result.verified_amount,
            verified_currency_code=result.verified_currency,
            result=PaymentTransaction.Result.FAILURE,
        )
        attempt.status = PaymentAttempt.Status.FAILED
        attempt.save(update_fields=["status", "updated_at"])
        if order.status == Order.Status.PAYMENT_PROCESSING:
            transition_order_status(
                order, Order.Status.PAYMENT_FAILED, reason=f"پرداخت ناموفق: {result.failure_reason}"
            )
        return {"order": order, "attempt": attempt, "outcome": "failed"}

    # Never trust the callback's own claim of amount/currency beyond what
    # the provider verification itself returned -- and even that must
    # match the order's own recorded total before we call it paid.
    if result.verified_amount != order.total_amount or result.verified_currency != order.currency_code:
        PaymentTransaction.objects.create(
            attempt=attempt,
            transaction_type=PaymentTransaction.TransactionType.VERIFICATION_FAILED,
            provider_reference=result.provider_reference,
            raw_payload=_scrub_payload(result.raw_payload),
            verified_amount_amount=result.verified_amount,
            verified_currency_code=result.verified_currency,
            result=PaymentTransaction.Result.AMOUNT_MISMATCH,
        )
        attempt.status = PaymentAttempt.Status.FAILED
        attempt.save(update_fields=["status", "updated_at"])
        if order.status == Order.Status.PAYMENT_PROCESSING:
            transition_order_status(order, Order.Status.PAYMENT_FAILED, reason="عدم تطابق مبلغ پرداخت")
        return {"order": order, "attempt": attempt, "outcome": "amount_mismatch"}

    PaymentTransaction.objects.create(
        attempt=attempt,
        transaction_type=PaymentTransaction.TransactionType.VERIFICATION_SUCCEEDED,
        provider_reference=result.provider_reference,
        raw_payload=_scrub_payload(result.raw_payload),
        verified_amount_amount=result.verified_amount,
        verified_currency_code=result.verified_currency,
        result=PaymentTransaction.Result.SUCCESS,
    )
    attempt.status = PaymentAttempt.Status.SUCCEEDED
    attempt.save(update_fields=["status", "updated_at"])

    _apply_inventory_on_payment_success(order)
    grant_course_entitlements(order)

    if order.status == Order.Status.PAYMENT_PROCESSING:
        transition_order_status(order, Order.Status.PAID, reason="پرداخت تأیید شد.")

    record_order_event(order, OrderEvent.EventType.PAYMENT_VERIFICATION, message="پرداخت با موفقیت تأیید شد.")

    return {"order": order, "attempt": attempt, "outcome": "success"}
