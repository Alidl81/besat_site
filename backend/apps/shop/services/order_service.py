"""Central order state machine. No call site anywhere in this app should
ever do `order.status = X; order.save()` directly -- always go through
`transition_order_status()` so the transition table is enforced in one
place and every change leaves an OrderEvent audit trail. Orders mutate
from four different call sites (checkout, payment callback, CMS actions,
the reservation-expiry job), which is exactly the situation an inline
per-view guard (fine for a single-actor model like News) stops being
safe for."""

from __future__ import annotations

from django.utils import timezone

from ..models import Order, OrderEvent

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Order.Status.DRAFT: {Order.Status.PENDING_PAYMENT, Order.Status.CANCELLED},
    Order.Status.PENDING_PAYMENT: {Order.Status.PAYMENT_PROCESSING, Order.Status.CANCELLED},
    Order.Status.PAYMENT_PROCESSING: {Order.Status.PAID, Order.Status.PAYMENT_FAILED},
    Order.Status.PAYMENT_FAILED: {Order.Status.PENDING_PAYMENT, Order.Status.CANCELLED},
    Order.Status.PAID: {
        Order.Status.PROCESSING,
        Order.Status.COMPLETED,
        Order.Status.REFUNDED,
        Order.Status.PARTIALLY_REFUNDED,
    },
    Order.Status.PROCESSING: {
        Order.Status.SHIPPED,
        Order.Status.COMPLETED,
        Order.Status.REFUNDED,
        Order.Status.PARTIALLY_REFUNDED,
    },
    Order.Status.SHIPPED: {
        Order.Status.COMPLETED,
        Order.Status.REFUNDED,
        Order.Status.PARTIALLY_REFUNDED,
    },
    Order.Status.COMPLETED: {Order.Status.REFUNDED, Order.Status.PARTIALLY_REFUNDED},
    Order.Status.CANCELLED: set(),
    Order.Status.REFUNDED: set(),
    Order.Status.PARTIALLY_REFUNDED: set(),
}

_TIMESTAMP_FIELD_BY_STATUS = {
    Order.Status.PAID: "paid_at",
    Order.Status.CANCELLED: "cancelled_at",
    Order.Status.REFUNDED: "refunded_at",
    Order.Status.PARTIALLY_REFUNDED: "refunded_at",
}


class InvalidOrderTransition(Exception):
    """Raised whenever code (including a bug) attempts a transition the
    table above does not allow."""


def transition_order_status(
    order: Order,
    to_status: str,
    *,
    actor=None,
    reason: str | None = None,
    metadata: dict | None = None,
) -> Order:
    """The only sanctioned way to change Order.status. Must be called
    inside a transaction that already holds a row lock on `order` when
    concurrent access is possible (checkout/payment/refund flows)."""
    from_status = order.status
    allowed = ALLOWED_TRANSITIONS.get(from_status, set())

    if to_status not in allowed:
        raise InvalidOrderTransition(
            f"انتقال وضعیت سفارش از «{order.get_status_display()}» به «{to_status}» مجاز نیست."
        )

    now = timezone.now()
    order.status = to_status

    if to_status == Order.Status.PENDING_PAYMENT and order.placed_at is None:
        order.placed_at = now

    timestamp_field = _TIMESTAMP_FIELD_BY_STATUS.get(to_status)
    if timestamp_field:
        setattr(order, timestamp_field, now)

    order.save()

    OrderEvent.objects.create(
        order=order,
        event_type=OrderEvent.EventType.STATUS_CHANGE,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        message=reason,
        metadata=metadata or {},
    )

    # Course-only orders have nothing to ship or fulfil -- they complete
    # the instant they're paid rather than waiting in "processing".
    if to_status == Order.Status.PAID and not order.requires_shipping:
        return transition_order_status(
            order,
            Order.Status.COMPLETED,
            actor=None,
            reason="تکمیل خودکار سفارش بدون نیاز به ارسال.",
        )

    return order


def record_order_event(
    order: Order,
    event_type: str,
    *,
    actor=None,
    message: str | None = None,
    metadata: dict | None = None,
) -> OrderEvent:
    """For audit events that are not themselves a status change
    (payment verification, inventory change, course access grant, ...)."""
    return OrderEvent.objects.create(
        order=order,
        event_type=event_type,
        actor=actor,
        message=message,
        metadata=metadata or {},
    )
