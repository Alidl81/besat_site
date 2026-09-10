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


def _is_current_attempt(order: Order, attempt: PaymentAttempt) -> bool:
    """An order can have several PaymentAttempt rows (one per retry). A
    callback for anything but the most recent one is stale: a later
    attempt is what actually determines where the order stands now, so a
    late-arriving success or failure for a superseded attempt must not be
    allowed to move the order's own status (PaymentAttempt.Meta.ordering
    is already "-created_at", "-id", so .first() is the current one)."""
    latest = order.payment_attempts.first()
    return latest is not None and latest.pk == attempt.pk


def _apply_inventory_on_payment_success(order: Order) -> tuple[list[str], set[int]]:
    """Applies inventory/entitlement effects only for order items whose
    stock reservation is still ACTIVE. A reservation stops being ACTIVE
    when `expire_stock_reservations` releases it after its hold expires
    (see that command) -- if a payment callback arrives late enough for
    that to have already happened, the stock may since have been sold to
    someone else, so applying the decrement/entitlement again here would
    be double-counting against a reservation that no longer represents a
    real hold. Returns (skipped_titles, skipped_order_item_ids): the
    titles for the caller to flag the order for manual reconciliation, and
    the order_item IDs so the caller can also skip course-entitlement
    granting for the exact same items -- grant_course_entitlements can't
    re-check reservation state itself, since a *legitimately* processed
    course item's reservation is already marked CONSUMED by the time it
    would run (right here, a few lines below)."""
    skipped_titles: list[str] = []
    skipped_order_item_ids: set[int] = set()
    for order_item in order.items.select_related("product", "variant").all():
        reservation = StockReservation.objects.filter(
            order_item=order_item, status=StockReservation.Status.ACTIVE
        ).first()
        if reservation is None:
            skipped_order_item_ids.add(order_item.pk)
            if order_item.product is not None:
                skipped_titles.append(order_item.product.title)
            continue
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

    return skipped_titles, skipped_order_item_ids


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
    is_current_attempt = _is_current_attempt(order, attempt)

    # PAY-SAME-ATTEMPT-REVERSAL-001: this used to only check for a PRIOR
    # SUCCESS, so a valid failure callback followed by a later valid
    # success for the SAME, STILL-CURRENT attempt sailed straight through
    # -- the attempt was already PaymentAttempt.Status.FAILED (set below,
    # in the failure branch), but nothing here checked that, so the late
    # success created a second, contradictory VERIFICATION_SUCCEEDED
    # transaction, flipped the attempt back to SUCCEEDED, and went on to
    # consume the order's inventory reservation and grant entitlements --
    # while the order itself stayed stuck at PAYMENT_FAILED, because the
    # PAID transition further below only fires when order.status is still
    # PAYMENT_PROCESSING. Once the CURRENT attempt reaches either terminal
    # state, a further callback for it can only be a contradiction or a
    # harmless repeat, never new information -- reject it outright, before
    # the provider is asked to re-verify it and before any side effect can
    # occur.
    #
    # Deliberately scoped to `is_current_attempt` only: a SUPERSEDED
    # attempt (one a retry has already moved past) can legitimately
    # receive its own late, real result from the provider after already
    # being marked FAILED here (e.g. the original webhook retried, or a
    # genuinely late success for an attempt this order gave up on) -- the
    # existing `elif not is_current_attempt` branches below already handle
    # that correctly (record an event for manual review, apply zero
    # inventory/entitlement/order-status side effects) and must keep
    # doing so; this check must not intercept that path.
    #
    # PAY-SAME-ATTEMPT-REVERSAL-001-R1: the original version of this check
    # only listed SUCCEEDED/FAILED -- the two terminal states the app's own
    # code currently ever assigns -- but PaymentAttempt.Status also defines
    # EXPIRED and CANCELLED as terminal outcomes. Any of the four means the
    # attempt is done and a further callback for it is a contradiction or a
    # replay, never new information, so all terminal states must be
    # rejected here, not just the ones today's code paths happen to reach.
    already_terminal_and_current = is_current_attempt and attempt.status in (
        PaymentAttempt.Status.SUCCEEDED,
        PaymentAttempt.Status.FAILED,
        PaymentAttempt.Status.EXPIRED,
        PaymentAttempt.Status.CANCELLED,
    )
    if already_terminal_and_current:
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
        if is_current_attempt and order.status == Order.Status.PAYMENT_PROCESSING:
            transition_order_status(
                order, Order.Status.PAYMENT_FAILED, reason=f"پرداخت ناموفق: {result.failure_reason}"
            )
        elif not is_current_attempt:
            # A newer attempt exists for this order -- it, not this stale
            # one, determines the order's real status now (this is the
            # PAY-002 race: a late failure for a superseded attempt must
            # not knock a since-succeeded/still-processing order back to
            # failed).
            record_order_event(
                order,
                OrderEvent.EventType.PAYMENT_VERIFICATION,
                message="نتیجه ناموفق یک تلاش پرداخت قدیمی‌تر دریافت شد و نادیده گرفته شد.",
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
        if is_current_attempt and order.status == Order.Status.PAYMENT_PROCESSING:
            transition_order_status(order, Order.Status.PAYMENT_FAILED, reason="عدم تطابق مبلغ پرداخت")
        elif not is_current_attempt:
            record_order_event(
                order,
                OrderEvent.EventType.PAYMENT_VERIFICATION,
                message="عدم تطابق مبلغ در یک تلاش پرداخت قدیمی‌تر دریافت شد و نادیده گرفته شد.",
            )
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

    if not is_current_attempt:
        # The provider confirmed real money moved for this attempt, but a
        # newer attempt has since superseded it for this order -- applying
        # inventory/entitlements or moving the order to PAID here could
        # double-apply against whatever the current attempt already did
        # (or will do), and would overwrite a status a more current
        # attempt is responsible for. Real funds may have moved on an
        # attempt this order no longer considers current, which needs a
        # human, not more automatic state changes -- record it and stop.
        record_order_event(
            order,
            OrderEvent.EventType.PAYMENT_VERIFICATION,
            message=(
                "نتیجه موفق یک تلاش پرداخت قدیمی‌تر دریافت شد. برای جلوگیری از "
                "اعمال دوباره تغییرات، وضعیت سفارش تغییر نکرد -- این مورد نیاز "
                "به بررسی دستی دارد."
            ),
        )
        return {"order": order, "attempt": attempt, "outcome": "success"}

    skipped_titles, skipped_order_item_ids = _apply_inventory_on_payment_success(order)
    grant_course_entitlements(order, skip_order_item_ids=skipped_order_item_ids)

    if order.status == Order.Status.PAYMENT_PROCESSING:
        transition_order_status(order, Order.Status.PAID, reason="پرداخت تأیید شد.")

    record_order_event(order, OrderEvent.EventType.PAYMENT_VERIFICATION, message="پرداخت با موفقیت تأیید شد.")
    if skipped_titles:
        record_order_event(
            order,
            OrderEvent.EventType.PAYMENT_VERIFICATION,
            message=(
                "رزرو موجودی برای این اقلام هنگام تأیید پرداخت دیگر فعال نبود "
                "و اثری روی موجودی/ظرفیت اعمال نشد؛ نیاز به بررسی دستی دارد: "
                + "، ".join(skipped_titles)
            ),
        )

    return {"order": order, "attempt": attempt, "outcome": "success"}
