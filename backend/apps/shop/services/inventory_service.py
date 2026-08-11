"""Shared stock/capacity locking and availability-math helpers used by
both cart display (soft checks, no lock) and checkout/payment (hard
checks, under select_for_update()). Keeping the arithmetic in one place
means the number a customer sees in their cart is computed the same way
checkout enforces it."""

from __future__ import annotations

from django.db.models import Sum

from ..models import InPersonCourseDetail, OnlineCourseDetail, PhysicalProductDetail, Product


def reserved_quantity(product, variant=None, *, exclude_order_id: int | None = None) -> int:
    from ..models import StockReservation

    qs = StockReservation.objects.filter(
        status=StockReservation.Status.ACTIVE,
        order_item__product=product,
        order_item__variant=variant,
    )
    if exclude_order_id is not None:
        qs = qs.exclude(order_item__order_id=exclude_order_id)
    return qs.aggregate(total=Sum("quantity"))["total"] or 0


def lock_detail_for_product(product: Product):
    """Locks (select_for_update) and returns the type-specific detail row
    for `product`. Must be called inside an open transaction. Callers that
    lock multiple products in one transaction MUST sort by product_id
    first to keep lock acquisition order consistent and deadlock-free."""
    if product.product_type == Product.ProductType.PHYSICAL:
        return PhysicalProductDetail.objects.select_for_update().get(pk=product.pk)
    if product.product_type == Product.ProductType.ONLINE_COURSE:
        return OnlineCourseDetail.objects.select_for_update().get(pk=product.pk)
    if product.product_type == Product.ProductType.IN_PERSON_COURSE:
        return InPersonCourseDetail.objects.select_for_update().get(pk=product.pk)
    raise ValueError(f"Unknown product_type: {product.product_type}")
