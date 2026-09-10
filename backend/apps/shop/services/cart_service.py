"""Cart resolution and mutation. Prices are never stored on CartItem --
every read re-derives them live from Product via pricing.effective_unit_price
so a cart never shows a stale price."""

from __future__ import annotations

import secrets
import time

from django.db import transaction

from ..models import Cart, CartItem, Product
from .inventory_service import reserved_quantity

MAX_QUANTITY_HARD_CAP = 50  # sanity ceiling independent of any per-product max
# REL-FE-CART-ADD-IDEMPOTENCY-INTERLEAVE-001 / REL-FE-CART-ADD-
# IDEMPOTENCY-WINDOW-001: how long a client_request_id is remembered as
# "already applied" for a CartItem row, and a defense-in-depth cap on how
# many distinct keys are kept regardless of age. The first version of
# this bound was a flat count (the last 20 keys, no matter how recent) --
# a live probe found that 22 genuinely distinct, back-to-back adds to the
# same line evicted the very first key before its own (very plausible,
# not just theoretical) delayed retry could still arrive, wrongly
# double-adding it. Time-bounding instead directly matches WHY this
# exists: cart-context.tsx's own client_request_id persistence (see
# ADD_REQUEST_ID_TTL_MS there) already never reuses a key older than 10
# minutes -- a well-behaved client structurally cannot present an older
# key as a "retry" claim, so the backend only needs to outlast that same
# realistic window, not survive an arbitrary count of legitimate adds.
# ADD_REQUEST_ID_TTL_SECONDS is set with a wide margin over the
# frontend's own window; MAX_TRACKED_ADD_REQUEST_IDS remains only as a
# hard ceiling against a pathological flood of adds within that window,
# not the primary retention mechanism.
ADD_REQUEST_ID_TTL_SECONDS = 15 * 60
MAX_TRACKED_ADD_REQUEST_IDS = 200


def _prune_add_request_ids(entries: list) -> list[dict]:
    """Keeps only still-fresh, well-formed {"id": ..., "ts": ...} entries,
    silently discarding anything else (a malformed/legacy entry, or one
    older than ADD_REQUEST_ID_TTL_SECONDS) -- this is a best-effort
    internal cache, never raising just because an entry doesn't parse."""
    now = time.time()
    fresh = [
        entry
        for entry in entries
        if isinstance(entry, dict)
        and isinstance(entry.get("id"), str)
        and isinstance(entry.get("ts"), (int, float))
        and now - entry["ts"] <= ADD_REQUEST_ID_TTL_SECONDS
    ]
    return fresh[-MAX_TRACKED_ADD_REQUEST_IDS:]


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


def add_item(
    cart: Cart,
    *,
    product_id: int,
    variant_id: int | None,
    quantity: int,
    client_request_id: str | None = None,
) -> CartItem:
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

    with transaction.atomic():
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant=variant,
            defaults={
                "quantity": quantity,
                "recent_add_request_ids": (
                    [{"id": client_request_id, "ts": time.time()}] if client_request_id else []
                ),
            },
        )
        if not created:
            # DB-SHOP-CART-ADD-SAME-TOKEN-RACE-001: the row get_or_create()
            # just found (whether from its own initial lookup, or from its
            # internal IntegrityError-retry fallback when a concurrent
            # add_item() for the same cart/product/variant won the create
            # race above) was NOT locked -- ten concurrent quantity-1 adds
            # for the same line all read the same pre-increment quantity,
            # each added their own contribution on top of it, and whichever
            # transaction committed last simply overwrote the rest (final
            # quantity 3 instead of the expected 10, observed live).
            # select_for_update() here is the exact same fix already
            # applied to merge_guest_cart_into_user()'s identical
            # read-modify-write below: it forces a concurrent add_item() to
            # block until the previous one commits, then re-read the
            # now-already-incremented quantity before adding its own
            # contribution, instead of racing an unlocked read.
            item = CartItem.objects.select_for_update().get(pk=item.pk)

            # REL-FE-CART-ADD-RESPONSE-LOSS-001 / REL-FE-CART-ADD-
            # IDEMPOTENCY-INTERLEAVE-001 / REL-FE-CART-ADD-IDEMPOTENCY-
            # WINDOW-001: unlike DELETE, an add is not naturally
            # idempotent -- a lost response followed by the client (or the
            # user re-clicking "Add to Cart") retrying the exact same
            # logical add is indistinguishable, from this request alone,
            # from a genuine second add. Pruned to only still-fresh
            # entries first (see _prune_add_request_ids()'s docstring for
            # why this is time-bounded, not count-bounded). When the
            # caller supplies a client_request_id matching ANY still-fresh
            # tracked attempt -- not just the most recent one, so a
            # delayed retry that arrives after a different, later add
            # already applied is still recognized -- that attempt already
            # committed this exact contribution; applying it again would
            # double-count. No-op and return the row as it already
            # stands.
            fresh_entries = _prune_add_request_ids(item.recent_add_request_ids)
            if client_request_id and client_request_id in {entry["id"] for entry in fresh_entries}:
                return item

            new_quantity = item.quantity + quantity if not product.is_course else 1
            item.quantity = min(new_quantity, MAX_QUANTITY_HARD_CAP)
            if client_request_id:
                fresh_entries.append({"id": client_request_id, "ts": time.time()})
            item.recent_add_request_ids = fresh_entries[-MAX_TRACKED_ADD_REQUEST_IDS:]
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
    is a no-op.

    CART-MERGE-001: two concurrent merge requests for the same guest_token
    used to both read guest_cart.status as still ACTIVE (check-then-act
    race), then both run the item-merge loop and race each other's
    destination CartItem.create() -- one request got a clean 200, the
    other an unhandled IntegrityError/500 (the eventual data was fine
    only because the losing request's whole transaction rolled back).
    select_for_update() below closes that race: it's wrapped in
    transaction.atomic() and, per Postgres's documented locking-read
    semantics, a SELECT ... FOR UPDATE that blocks on another
    transaction's lock re-checks its WHERE clause against the row's
    post-commit state once unblocked. So the second request waits for the
    first to commit (status -> MERGED), then re-evaluates
    status=ACTIVE, finds it no longer true, and cleanly no-ops -- instead
    of re-running the merge loop and racing the first request.
    """
    user_cart, _ = get_or_create_active_cart(user=user)

    with transaction.atomic():
        guest_cart = (
            Cart.objects.select_for_update()
            .filter(guest_token=guest_token, status=Cart.Status.ACTIVE)
            .first()
        )
        if guest_cart is None or guest_cart.pk == user_cart.pk:
            return user_cart

        for guest_item in guest_cart.items.select_related("product", "variant").all():
            # get_or_create() (not filter().first() + create()) as
            # defense in depth -- e.g. two *different* guest carts merging
            # into the same destination concurrently and colliding on
            # product/variant -- mirroring add_item()'s reasoning above:
            # Django catches the IntegrityError and re-fetches the row
            # instead of the DB's unique_cart_product_variant violation
            # surfacing as a raw 500.
            item, created = CartItem.objects.get_or_create(
                cart=user_cart,
                product=guest_item.product,
                variant=guest_item.variant,
                defaults={"quantity": guest_item.quantity},
            )
            if not created and not guest_item.product.is_course:
                # DB-SHOP-CART-MERGE-DESTINATION-RACE-001: the row
                # get_or_create() just found (whether from its own initial
                # lookup, or from its internal IntegrityError-retry fallback
                # when a concurrent creator won the race above) is NOT
                # locked -- ten different guest carts merging into this same
                # destination line concurrently all read the same
                # pre-increment quantity, each added their own contribution
                # on top of it, and whichever transaction committed last
                # simply overwrote the rest (final quantity 2 instead of the
                # expected 11, observed live). select_for_update() here
                # forces exactly the same serialize-and-re-read behavior
                # already documented above for guest_cart's own lock: a
                # concurrent merge blocks until the previous one commits,
                # then re-reads the now-already-incremented quantity before
                # adding its own contribution, instead of racing an
                # unlocked read.
                item = CartItem.objects.select_for_update().get(pk=item.pk)
                item.quantity = min(item.quantity + guest_item.quantity, MAX_QUANTITY_HARD_CAP)
                item.full_clean()
                item.save()

        guest_cart.status = Cart.Status.MERGED
        guest_cart.save(update_fields=["status", "updated_at"])

    return user_cart
