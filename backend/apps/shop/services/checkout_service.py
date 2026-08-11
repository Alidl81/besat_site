"""Checkout preview and order placement. `place_order` is the single most
concurrency-sensitive function in the app: it holds row locks on every
product's type-specific detail table for the duration of the order-
creation transaction, so two customers racing for the last unit of stock
(or the last seat in a course) can never both succeed."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from ..models import Cart, Order, OrderItem, Product, ShopSettings, StockReservation
from .cart_service import resolve_cart_item_issue
from .inventory_service import lock_detail_for_product, reserved_quantity
from .order_service import transition_order_status
from .pricing import effective_unit_price


class CheckoutError(Exception):
    def __init__(self, code: str, message: str, field: str | None = None):
        self.code = code
        self.field = field
        super().__init__(message)


def _sku_for(product: Product, variant) -> str | None:
    if variant is not None:
        return variant.sku
    detail = getattr(product, "physical_detail", None)
    return detail.sku if detail else None


def build_checkout_preview(cart: Cart, *, shipping_method=None) -> dict:
    items_payload = []
    subtotal_amount = 0
    requires_shipping = False
    blocking = False

    for item in cart.items.select_related(
        "product", "product__physical_detail", "product__online_course_detail",
        "product__in_person_course_detail", "variant",
    ).all():
        issue = resolve_cart_item_issue(item)
        unit_price = effective_unit_price(item.product, item.variant)
        line_total = unit_price * item.quantity
        subtotal_amount += line_total

        if item.product.product_type == Product.ProductType.PHYSICAL:
            detail = getattr(item.product, "physical_detail", None)
            if detail and detail.requires_shipping:
                requires_shipping = True

        if issue:
            blocking = True

        items_payload.append(
            {
                "cart_item_id": item.pk,
                "product_id": item.product_id,
                "title": item.product.title,
                "quantity": item.quantity,
                "unit_price_amount": unit_price,
                "line_total_amount": line_total,
                "issue": issue,
            }
        )

    shipping_amount = shipping_method.price_amount if (requires_shipping and shipping_method) else 0
    total_amount = subtotal_amount + shipping_amount

    return {
        "items": items_payload,
        "subtotal_amount": subtotal_amount,
        "shipping_amount": shipping_amount,
        "discount_amount": 0,
        "tax_amount": 0,
        "total_amount": total_amount,
        "requires_shipping": requires_shipping,
        "can_checkout": bool(items_payload) and not blocking,
    }


def _address_snapshot_fields(address) -> dict:
    return {
        "shipping_recipient_name": address.recipient_full_name,
        "shipping_phone": address.phone,
        "shipping_province": address.province,
        "shipping_city": address.city,
        "shipping_address_line1": address.address_line1,
        "shipping_address_line2": address.address_line2,
        "shipping_postal_code": address.postal_code,
    }


@transaction.atomic
def place_order(
    cart: Cart,
    user,
    *,
    shipping_method=None,
    shipping_address=None,
    customer_note: str | None = None,
) -> Order:
    locked_cart = Cart.objects.select_for_update().get(pk=cart.pk)

    if locked_cart.status != Cart.Status.ACTIVE:
        raise CheckoutError("cart_not_active", "این سبد قبلاً تبدیل به سفارش شده یا نامعتبر است.")

    items = list(locked_cart.items.select_related("product", "variant").order_by("id"))
    if not items:
        raise CheckoutError("empty_cart", "سبد خرید خالی است.")

    # Lock every distinct product's detail row up front, in a stable order
    # (ascending product id), so two concurrent checkouts touching the
    # same products always acquire locks in the same order -- the
    # standard technique to make concurrent transactions serialize
    # instead of deadlock.
    locked_details = {}
    for product_id in sorted({item.product_id for item in items}):
        product = next(item.product for item in items if item.product_id == product_id)
        locked_details[product_id] = lock_detail_for_product(product)

    requires_shipping = False
    order_items_data = []

    for item in items:
        product = item.product
        if product.status != Product.Status.PUBLISHED or not product.is_active:
            raise CheckoutError("product_unavailable", f"«{product.title}» دیگر در دسترس نیست.")

        detail = locked_details[product.pk]

        if product.product_type == Product.ProductType.PHYSICAL:
            if detail.availability == detail.Availability.DISCONTINUED:
                raise CheckoutError("product_unavailable", f"«{product.title}» دیگر در دسترس نیست.")

            on_hand = item.variant.inventory_qty if item.variant_id else detail.inventory_qty
            reserved = reserved_quantity(product, item.variant)
            if on_hand - reserved < item.quantity:
                raise CheckoutError("out_of_stock", f"موجودی «{product.title}» کافی نیست.")

            if detail.max_purchase_quantity and item.quantity > detail.max_purchase_quantity:
                raise CheckoutError(
                    "max_quantity_exceeded", f"حداکثر تعداد خرید «{product.title}» {detail.max_purchase_quantity} است."
                )

            if detail.requires_shipping:
                requires_shipping = True

        elif product.is_course:
            if item.quantity != 1:
                raise CheckoutError("invalid_quantity", f"برای «{product.title}» فقط یک عدد قابل خرید است.")
            if detail.enrollment_status == detail.EnrollmentStatus.CLOSED:
                raise CheckoutError("product_unavailable", f"ثبت‌نام «{product.title}» بسته است.")
            if detail.capacity is not None:
                reserved = reserved_quantity(product, None)
                if detail.capacity - detail.enrolled_count - reserved < 1:
                    raise CheckoutError("course_full", f"ظرفیت «{product.title}» تکمیل است.")

        unit_price = effective_unit_price(product, item.variant)
        order_items_data.append(
            {
                "product": product,
                "variant": item.variant,
                "unit_price": unit_price,
                "quantity": item.quantity,
            }
        )

    if requires_shipping and shipping_address is None:
        raise CheckoutError("shipping_address_required", "برای این سفارش، آدرس ارسال الزامی است.", field="address_id")
    if requires_shipping and shipping_method is None:
        raise CheckoutError("shipping_method_required", "انتخاب روش ارسال الزامی است.", field="shipping_method_id")

    subtotal_amount = sum(d["unit_price"] * d["quantity"] for d in order_items_data)
    shipping_amount = shipping_method.price_amount if (requires_shipping and shipping_method) else 0
    total_amount = subtotal_amount + shipping_amount

    order_kwargs = dict(
        user=user,
        cart=locked_cart,
        subtotal_amount=subtotal_amount,
        shipping_amount=shipping_amount,
        discount_amount=0,
        tax_amount=0,
        total_amount=total_amount,
        requires_shipping=requires_shipping,
        shipping_method=shipping_method if requires_shipping else None,
        customer_note=customer_note or None,
    )
    if requires_shipping and shipping_address is not None:
        order_kwargs.update(_address_snapshot_fields(shipping_address))

    order = Order.objects.create(**order_kwargs)

    settings_obj = ShopSettings.load()
    expires_at = timezone.now() + timedelta(minutes=settings_obj.reservation_hold_minutes)

    for data in order_items_data:
        order_item = OrderItem.objects.create(
            order=order,
            product=data["product"],
            variant=data["variant"],
            product_type_snapshot=data["product"].product_type,
            title_snapshot=data["product"].title,
            sku_snapshot=_sku_for(data["product"], data["variant"]),
            unit_price_amount_snapshot=data["unit_price"],
            quantity=data["quantity"],
            line_total_amount=data["unit_price"] * data["quantity"],
        )
        StockReservation.objects.create(
            order_item=order_item, quantity=data["quantity"], expires_at=expires_at
        )

    transition_order_status(order, Order.Status.PENDING_PAYMENT, actor=user, reason="سفارش ثبت شد.")

    locked_cart.status = Cart.Status.CONVERTED
    locked_cart.save(update_fields=["status", "updated_at"])

    return order
