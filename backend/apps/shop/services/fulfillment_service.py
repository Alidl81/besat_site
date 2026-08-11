"""Admin-only order fulfillment actions (processing/shipped/completed/
cancel/refund). Every mutation goes through transition_order_status for
the audit trail, and refunds reverse exactly what payment_service applied
on the way in (stock/seats restored, course access revoked) -- never a
partial or approximate undo."""

from __future__ import annotations

from django.db import transaction

from ..models import (
    InPersonCourseDetail,
    OnlineCourseDetail,
    Order,
    OrderEvent,
    PhysicalProductDetail,
    Product,
    ProductVariant,
    StockReservation,
)
from .course_service import revoke_course_entitlements
from .order_service import record_order_event, transition_order_status


@transaction.atomic
def mark_processing(order: Order, actor) -> Order:
    locked = Order.objects.select_for_update().get(pk=order.pk)
    return transition_order_status(locked, Order.Status.PROCESSING, actor=actor, reason="شروع پردازش سفارش.")


@transaction.atomic
def mark_shipped(order: Order, actor) -> Order:
    locked = Order.objects.select_for_update().get(pk=order.pk)
    transitioned = transition_order_status(locked, Order.Status.SHIPPED, actor=actor, reason="سفارش ارسال شد.")
    record_order_event(transitioned, OrderEvent.EventType.SHIPPING_CHANGE, actor=actor, message="سفارش ارسال شد.")
    return transitioned


@transaction.atomic
def mark_completed(order: Order, actor) -> Order:
    locked = Order.objects.select_for_update().get(pk=order.pk)
    return transition_order_status(locked, Order.Status.COMPLETED, actor=actor, reason="سفارش تکمیل شد.")


@transaction.atomic
def cancel_order(order: Order, actor, *, reason: str | None = None) -> Order:
    locked = Order.objects.select_for_update().get(pk=order.pk)
    StockReservation.objects.filter(
        order_item__order=locked, status=StockReservation.Status.ACTIVE
    ).update(status=StockReservation.Status.RELEASED)
    return transition_order_status(locked, Order.Status.CANCELLED, actor=actor, reason=reason or "لغو توسط مدیر.")


def _restore_inventory(order: Order, actor) -> None:
    for order_item in order.items.select_related("product", "variant").all():
        product = order_item.product
        if product is None:
            continue

        if product.product_type == Product.ProductType.PHYSICAL:
            if order_item.variant_id:
                variant = ProductVariant.objects.select_for_update().get(pk=order_item.variant_id)
                variant.inventory_qty += order_item.quantity
                variant.save(update_fields=["inventory_qty", "updated_at"])
            else:
                detail = PhysicalProductDetail.objects.select_for_update().get(pk=product.pk)
                detail.inventory_qty += order_item.quantity
                detail.recompute_availability(commit=False)
                detail.save()
        elif product.product_type == Product.ProductType.ONLINE_COURSE:
            detail = OnlineCourseDetail.objects.select_for_update().get(pk=product.pk)
            detail.enrolled_count = max(detail.enrolled_count - order_item.quantity, 0)
            detail.recompute_enrollment_status(commit=False)
            detail.save()
        elif product.product_type == Product.ProductType.IN_PERSON_COURSE:
            detail = InPersonCourseDetail.objects.select_for_update().get(pk=product.pk)
            detail.enrolled_count = max(detail.enrolled_count - order_item.quantity, 0)
            detail.recompute_enrollment_status(commit=False)
            detail.save()

    record_order_event(order, OrderEvent.EventType.INVENTORY_CHANGE, actor=actor, message="موجودی/ظرفیت بازگردانی شد.")


@transaction.atomic
def refund_order(order: Order, actor, *, partial: bool = False, reason: str | None = None) -> Order:
    locked = Order.objects.select_for_update().get(pk=order.pk)

    to_status = Order.Status.PARTIALLY_REFUNDED if partial else Order.Status.REFUNDED
    transitioned = transition_order_status(locked, to_status, actor=actor, reason=reason or "بازگشت وجه.")

    if not partial:
        _restore_inventory(transitioned, actor)
        revoke_course_entitlements(transitioned, actor=actor)

    record_order_event(
        transitioned, OrderEvent.EventType.REFUND, actor=actor,
        message=reason or ("بازگشت جزئی وجه." if partial else "بازگشت کامل وجه."),
    )
    return transitioned
