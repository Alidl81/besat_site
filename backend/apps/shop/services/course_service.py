"""Course entitlement grant/revoke. grant_course_entitlements is called
ONLY from payment_service after a payment has been verified server-side
-- there is no other, client-reachable path that creates a
CourseEnrollment row anywhere in this app."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from ..models import CourseEnrollment, OnlineCourseDetail, Order, OrderEvent, Product
from .order_service import record_order_event


def grant_course_entitlements(order: Order) -> None:
    for order_item in order.items.select_related(
        "product", "product__online_course_detail", "product__in_person_course_detail"
    ).all():
        product = order_item.product
        if product is None or not product.is_course:
            continue
        if hasattr(order_item, "course_enrollment"):
            continue  # already granted -- defensive, shouldn't happen given the replay guard

        is_confirmed = True
        access_url = None
        access_notes = None
        access_expires_at = None

        if product.product_type == Product.ProductType.ONLINE_COURSE:
            detail = getattr(product, "online_course_detail", None)
            if detail is not None:
                if detail.access_destination_type == OnlineCourseDetail.AccessDestinationType.EXTERNAL_LINK:
                    access_url = detail.access_destination_value
                else:
                    access_notes = detail.access_destination_value
                if detail.access_duration_days:
                    access_expires_at = timezone.now() + timedelta(days=detail.access_duration_days)
        else:
            detail = getattr(product, "in_person_course_detail", None)
            if detail is not None and detail.requires_enrollment_confirmation:
                is_confirmed = False

        CourseEnrollment.objects.create(
            user=order.user,
            product=product,
            order_item=order_item,
            is_confirmed=is_confirmed,
            access_url=access_url,
            access_notes=access_notes,
            access_expires_at=access_expires_at,
        )

    record_order_event(
        order, OrderEvent.EventType.COURSE_ACCESS_GRANTED, message="دسترسی دوره(های) این سفارش اعطا شد."
    )


def revoke_course_entitlements(order: Order, *, actor=None) -> None:
    enrollments = CourseEnrollment.objects.filter(order_item__order=order, status=CourseEnrollment.Status.ACTIVE)
    now = timezone.now()
    updated = enrollments.update(status=CourseEnrollment.Status.REVOKED, revoked_at=now, revoked_by=actor)
    if updated:
        record_order_event(
            order, OrderEvent.EventType.COURSE_ACCESS_REVOKED, actor=actor,
            message="دسترسی دوره(های) این سفارش لغو شد.",
        )
