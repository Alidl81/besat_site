from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel

from .catalog import Product, ProductVariant


class Cart(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "فعال"
        MERGED = "merged", "ادغام‌شده"
        CONVERTED = "converted", "تبدیل‌شده به سفارش"
        ABANDONED = "abandoned", "رهاشده"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="shop_carts",
        verbose_name="کاربر",
    )
    guest_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="توکن سبد مهمان",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="وضعیت",
    )

    class Meta:
        verbose_name = "سبد خرید"
        verbose_name_plural = "سبدهای خرید"
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("user",),
                condition=Q(status="active"),
                name="unique_active_cart_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=("user", "status")),
            models.Index(fields=("guest_token", "status")),
        ]

    def __str__(self):
        return f"سبد #{self.pk} ({self.get_status_display()})"

    def clean(self):
        super().clean()
        has_user = self.user_id is not None
        has_guest_token = bool(self.guest_token)
        if has_user == has_guest_token:
            raise ValidationError(
                "سبد خرید باید دقیقاً یکی از کاربر یا توکن مهمان را داشته باشد."
            )


class CartItem(TimeStampedModel):
    """No price snapshot -- always re-priced live from Product on read.
    Only OrderItem snapshots, per the immutable-history requirement."""

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items", verbose_name="سبد")
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="cart_items", verbose_name="محصول"
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cart_items",
        verbose_name="گزینه محصول",
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name="تعداد")
    # REL-FE-CART-ADD-RESPONSE-LOSS-001 / REL-FE-CART-ADD-IDEMPOTENCY-
    # INTERLEAVE-001 / REL-FE-CART-ADD-IDEMPOTENCY-WINDOW-001: unlike
    # DELETE, an add-to-cart POST is NOT naturally idempotent -- a lost
    # response followed by the same user clicking "Add to Cart" again for
    # the same product is indistinguishable, from the server's own
    # request, from a genuine second add. A single "last key" field (the
    # first version of this fix) only remembered the MOST RECENT add's
    # key -- a later, different add silently displaced an earlier one, so
    # a delayed retry of that earlier key arriving after the newer one
    # wrongly counted as a brand-new add. A flat count-bounded list (the
    # second version) fixed that but had its own edge: a live probe found
    # 22 genuinely distinct, legitimate adds to the same line could evict
    # the very first key before a still-plausible delayed retry of it
    # arrived. Each entry is now `{"id": ..., "ts": ...}` and add_item()
    # prunes to only entries younger than its own TTL before checking --
    # bounded by TIME (matching cart-context.tsx's own client-side
    # ADD_REQUEST_ID_TTL_MS, so a well-behaved client structurally never
    # presents a key older than that window as a "retry" claim anyway),
    # with a generous count cap only as a defense-in-depth ceiling against
    # a pathological flood within that window, not the primary bound.
    # Empty list means no key was ever supplied (an older/other client)
    # -- add_item() then falls back to its old always-increment behavior
    # for that row.
    # OPS-BACKEND-SCHEMA-DRIFT-001: a Django-level `default=` only applies
    # when the ORM's OWN, currently-loaded model class constructs a row --
    # it was never a real column-level default in Postgres, so a request
    # served by a stale worker still running pre-migration application
    # code (a real, recurring window during any rolling deploy, not just
    # this dev environment's one-off migration lag) could INSERT a row
    # with no value for this column at all, and Postgres correctly
    # rejected it as a NOT NULL violation with no default to fall back
    # on. `db_default` makes `[]` a genuine server-side default, so any
    # writer -- current code, stale code, a future raw insert, Django
    # admin -- gets a valid empty list even if it never mentions this
    # column at all.
    recent_add_request_ids = models.JSONField(
        default=list, db_default=[], blank=True, verbose_name="شناسه‌های اخیر درخواست افزودن"
    )

    class Meta:
        verbose_name = "آیتم سبد خرید"
        verbose_name_plural = "آیتم‌های سبد خرید"
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=("cart", "product", "variant"),
                name="unique_cart_product_variant",
                # Without this, two rows for the same (cart, product) with
                # variant=NULL are NOT duplicates under standard SQL NULL
                # semantics (NULL is never equal to NULL), so the
                # constraint silently did nothing for every non-variant
                # product -- get_or_create()'s read-then-write in
                # cart_service.add_item() could (and, under concurrent
                # requests, did) create two separate CartItem rows for the
                # same cart/product. nulls_distinct=False (Postgres 15+'s
                # NULLS NOT DISTINCT) makes NULL variants collide for
                # uniqueness purposes too, so the DB itself now rejects a
                # concurrent duplicate insert -- which get_or_create()
                # already knows how to recover from (catches the
                # IntegrityError and re-fetches the existing row), so no
                # application-level locking/retry logic was needed on top.
                nulls_distinct=False,
            ),
        ]

    def __str__(self):
        return f"{self.product.title} x{self.quantity}"

    def clean(self):
        super().clean()
        if self.quantity < 1:
            raise ValidationError({"quantity": "تعداد باید حداقل ۱ باشد."})
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValidationError({"variant": "گزینه انتخاب‌شده متعلق به این محصول نیست."})
