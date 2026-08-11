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

    class Meta:
        verbose_name = "آیتم سبد خرید"
        verbose_name_plural = "آیتم‌های سبد خرید"
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=("cart", "product", "variant"),
                name="unique_cart_product_variant",
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
