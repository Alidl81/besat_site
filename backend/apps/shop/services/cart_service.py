"""Cart resolution and mutation. Prices are never stored on CartItem --
every read re-derives them live from Product via pricing.effective_unit_price
so a cart never shows a stale price."""

from __future__ import annotations

import secrets

from ..models import Cart, CartItem, Product
from .inventory_service import reserved_quantity

MAX_QUANTITY_HARD_CAP = 50  # sanity ceiling independent of any per-product max


class CartError(Exception):
    def __init__(self, code: str, message: str, field: str | None = None):
        self.code = code
        self.field = field
        super().__init__(message)


def get_or_create_active_cart(*, user=None, guest_token: str | None = None) -> tuple[Cart, str | None]:
    """Returns (cart, new_guest_token). new_guest_token is non-None only
    when a brand-new guest cart had to be created, so callers know to
    hand the token back to the client."""
    if user is not None and user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(
            user=user, status=Cart.Status.ACTIVE, defaults={"guest_token": None}
        )
        return cart, None

    if guest_token:
        cart = Cart.objects.filter(guest_token=guest_token, status=Cart.Status.ACTIVE).first()
        if cart is not None:
            return cart, None

    new_token = secrets.token_urlsafe(32)
    cart = Cart.objects.create(guest_token=new_token, status=Cart.Status.ACTIVE)
    return cart, new_token


def resolve_cart_item_issue(item: CartItem) -> str | None:
    """None means the item can be checked out as-is."""
    product = item.product

    if product.status != Product.Status.PUBLISHED or not product.is_active:
        return "unavailable"

    if product.product_type == Product.ProductType.PHYSICAL:
        detail = getattr(product, "physical_detail", None)
        if detail is None:
            return "unavailable"
        if detail.availability == detail.Availability.DISCONTINUED:
            return "unavailable"
        reserved = reserved_quantity(product, item.variant)
        on_hand = item.variant.inventory_qty if item.variant_id else detail.inventory_qty
        if on_hand - reserved < item.quantity:
            return "insufficient_stock"
        if detail.max_purchase_quantity and item.quantity > detail.max_purchase_quantity:
            return "max_quantity_exceeded"
    elif product.is_course:
        if item.quantity != 1:
            return "invalid_quantity"
        detail = (
            getattr(product, "online_course_detail", None)
            if product.product_type == Product.ProductType.ONLINE_COURSE
            else getattr(product, "in_person_course_detail", None)
        )
        if detail is None:
            return "unavailable"
        if detail.enrollment_status == detail.EnrollmentStatus.CLOSED:
            return "unavailable"
        if detail.capacity is not None:
            reserved = reserved_quantity(product, None)
            if detail.capacity - detail.enrolled_count - reserved < 1:
                return "course_full"

    return None


def add_item(cart: Cart, *, product_id: int, variant_id: int | None, quantity: int) -> CartItem:
    if quantity < 1 or quantity > MAX_QUANTITY_HARD_CAP:
        raise CartError("invalid_quantity", "تعداد نامعتبر است.", field="quantity")

    try:
        product = Product.objects.get(pk=product_id, is_active=True, status=Product.Status.PUBLISHED)
    except Product.DoesNotExist as exc:
        raise CartError("product_not_found", "محصول یافت نشد.", field="product_id") from exc

    variant = None
    if variant_id is not None:
        variant = product.variants.filter(pk=variant_id, is_active=True).first()
        if variant is None:
            raise CartError("variant_not_found", "گزینه انتخاب‌شده یافت نشد.", field="variant_id")

    if product.is_course and quantity != 1:
        raise CartError("invalid_quantity", "برای دوره‌ها فقط یک عدد قابل خرید است.", field="quantity")

    item, created = CartItem.objects.get_or_create(
        cart=cart, product=product, variant=variant, defaults={"quantity": quantity}
    )
    if not created:
        new_quantity = item.quantity + quantity if not product.is_course else 1
        item.quantity = min(new_quantity, MAX_QUANTITY_HARD_CAP)
        item.full_clean()
        item.save()

    return item


def update_item_quantity(cart: Cart, item_id: int, quantity: int) -> CartItem:
    if quantity < 1 or quantity > MAX_QUANTITY_HARD_CAP:
        raise CartError("invalid_quantity", "تعداد نامعتبر است.", field="quantity")

    try:
        item = cart.items.select_related("product").get(pk=item_id)
    except CartItem.DoesNotExist as exc:
        raise CartError("item_not_found", "آیتم سبد یافت نشد.") from exc

    if item.product.is_course and quantity != 1:
        raise CartError("invalid_quantity", "برای دوره‌ها فقط یک عدد قابل خرید است.", field="quantity")

    item.quantity = quantity
    item.full_clean()
    item.save()
    return item


def remove_item(cart: Cart, item_id: int) -> None:
    deleted, _ = cart.items.filter(pk=item_id).delete()
    if not deleted:
        raise CartError("item_not_found", "آیتم سبد یافت نشد.")


def merge_guest_cart_into_user(user, guest_token: str) -> Cart:
    """Folds a guest cart's items into the user's active cart, summing
    quantities for duplicate product/variant lines, then marks the guest
    cart merged. Idempotent: calling again with an already-merged token
    is a no-op."""
    user_cart, _ = get_or_create_active_cart(user=user)

    guest_cart = Cart.objects.filter(guest_token=guest_token, status=Cart.Status.ACTIVE).first()
    if guest_cart is None or guest_cart.pk == user_cart.pk:
        return user_cart

    for guest_item in guest_cart.items.select_related("product", "variant").all():
        existing = user_cart.items.filter(product=guest_item.product, variant=guest_item.variant).first()
        if existing:
            if not guest_item.product.is_course:
                existing.quantity = min(existing.quantity + guest_item.quantity, MAX_QUANTITY_HARD_CAP)
                existing.full_clean()
                existing.save()
        else:
            CartItem.objects.create(
                cart=user_cart,
                product=guest_item.product,
                variant=guest_item.variant,
                quantity=guest_item.quantity,
            )

    guest_cart.status = Cart.Status.MERGED
    guest_cart.save(update_fields=["status", "updated_at"])

    return user_cart
