import secrets
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.core.utils import normalize_text

from .. import money
from .catalog import Product, ProductVariant
from .cart import Cart
from .settings import ShippingMethod


def _generate_order_number() -> str:
    today = date.today()
    return f"BST-{today:%Y%m%d}-{secrets.token_hex(3).upper()}"


class Address(TimeStampedModel):
    """The parent's live, editable saved-address book. Separate from the
    frozen shipping_* snapshot fields on Order -- editing a saved address
    must never alter the shipping details of a past order."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_addresses",
        verbose_name="کاربر",
    )
    recipient_full_name = models.CharField(max_length=255, verbose_name="نام گیرنده")
    phone = models.CharField(max_length=50, verbose_name="شماره تماس")
    province = models.CharField(max_length=100, verbose_name="استان")
    city = models.CharField(max_length=100, verbose_name="شهر")
    address_line1 = models.CharField(max_length=500, verbose_name="آدرس")
    address_line2 = models.CharField(max_length=500, null=True, blank=True, verbose_name="آدرس تکمیلی")
    postal_code = models.CharField(max_length=20, null=True, blank=True, verbose_name="کد پستی")
    is_default = models.BooleanField(default=False, verbose_name="آدرس پیش‌فرض؟")

    class Meta:
        verbose_name = "آدرس"
        verbose_name_plural = "آدرس‌ها"
        ordering = ("-is_default", "-created_at", "-id")
        indexes = [models.Index(fields=("user", "is_default"))]

    def __str__(self):
        return f"{self.recipient_full_name} - {self.city}"

    def clean(self):
        super().clean()
        for field_name in (
            "recipient_full_name",
            "phone",
            "province",
            "city",
            "address_line1",
            "address_line2",
            "postal_code",
        ):
            value = getattr(self, field_name)
            if isinstance(value, str):
                normalized = normalize_text(value)
                setattr(self, field_name, normalized if field_name in (
                    "recipient_full_name", "phone", "province", "city", "address_line1",
                ) else (normalized or None))

        errors = {}
        for required_field in (
            "recipient_full_name", "phone", "province", "city", "address_line1",
        ):
            if not getattr(self, required_field):
                errors[required_field] = "این فیلد الزامی است."
        if errors:
            raise ValidationError(errors)


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PENDING_PAYMENT = "pending_payment", "در انتظار پرداخت"
        PAYMENT_PROCESSING = "payment_processing", "در حال پردازش پرداخت"
        PAID = "paid", "پرداخت‌شده"
        PROCESSING = "processing", "در حال پردازش"
        SHIPPED = "shipped", "ارسال‌شده"
        COMPLETED = "completed", "تکمیل‌شده"
        CANCELLED = "cancelled", "لغوشده"
        PAYMENT_FAILED = "payment_failed", "پرداخت ناموفق"
        REFUNDED = "refunded", "بازگشت‌داده‌شده"
        PARTIALLY_REFUNDED = "partially_refunded", "بازگشت‌جزئی"

    order_number = models.CharField(max_length=32, unique=True, verbose_name="شماره سفارش")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # Financial records must survive account deletion for audit purposes,
        # unlike the SET_NULL audit FKs (created_by/etc.) used elsewhere.
        on_delete=models.PROTECT,
        related_name="shop_orders",
        verbose_name="کاربر",
    )
    cart = models.ForeignKey(
        Cart,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="سبد خرید مبدأ",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        verbose_name="وضعیت",
    )
    currency_code = models.CharField(max_length=10, default=money.STORAGE_CURRENCY, verbose_name="واحد پول")
    subtotal_amount = models.PositiveBigIntegerField(default=0, verbose_name="جمع جزء (ریال)")
    discount_amount = models.PositiveBigIntegerField(default=0, verbose_name="تخفیف (ریال)")
    shipping_amount = models.PositiveBigIntegerField(default=0, verbose_name="هزینه ارسال (ریال)")
    tax_amount = models.PositiveBigIntegerField(default=0, verbose_name="مالیات (ریال)")
    total_amount = models.PositiveBigIntegerField(default=0, verbose_name="جمع کل (ریال)")
    requires_shipping = models.BooleanField(default=False, verbose_name="نیاز به ارسال دارد؟")
    shipping_method = models.ForeignKey(
        ShippingMethod,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="روش ارسال",
    )
    shipping_recipient_name = models.CharField(max_length=255, null=True, blank=True, verbose_name="نام گیرنده")
    shipping_phone = models.CharField(max_length=50, null=True, blank=True, verbose_name="شماره تماس گیرنده")
    shipping_province = models.CharField(max_length=100, null=True, blank=True, verbose_name="استان")
    shipping_city = models.CharField(max_length=100, null=True, blank=True, verbose_name="شهر")
    shipping_address_line1 = models.CharField(max_length=500, null=True, blank=True, verbose_name="آدرس")
    shipping_address_line2 = models.CharField(max_length=500, null=True, blank=True, verbose_name="آدرس تکمیلی")
    shipping_postal_code = models.CharField(max_length=20, null=True, blank=True, verbose_name="کد پستی")
    customer_note = models.TextField(null=True, blank=True, verbose_name="یادداشت مشتری")
    admin_note = models.TextField(null=True, blank=True, verbose_name="یادداشت داخلی")
    placed_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان ثبت سفارش")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان پرداخت")
    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان لغو")
    refunded_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان بازگشت وجه")

    class Meta:
        verbose_name = "سفارش"
        verbose_name_plural = "سفارش‌ها"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("user", "status")),
            models.Index(fields=("status", "created_at")),
        ]

    def __str__(self):
        return self.order_number

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_unique_order_number()
        super().save(*args, **kwargs)

    def _generate_unique_order_number(self):
        for _ in range(10):
            candidate = _generate_order_number()
            if not Order.objects.filter(order_number=candidate).exists():
                return candidate
        raise RuntimeError("امکان ساخت شماره سفارش یکتا وجود ندارد.")


class OrderItem(TimeStampedModel):
    """Immutable snapshot -- later edits to Product must never change what
    a past order shows or charged."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items", verbose_name="سفارش")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name="محصول",
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name="گزینه محصول",
    )
    product_type_snapshot = models.CharField(max_length=30, verbose_name="نوع محصول (زمان خرید)")
    title_snapshot = models.CharField(max_length=255, verbose_name="عنوان (زمان خرید)")
    sku_snapshot = models.CharField(max_length=100, null=True, blank=True, verbose_name="کد کالا (زمان خرید)")
    unit_price_amount_snapshot = models.PositiveBigIntegerField(verbose_name="قیمت واحد (زمان خرید، ریال)")
    quantity = models.PositiveIntegerField(default=1, verbose_name="تعداد")
    line_total_amount = models.PositiveBigIntegerField(verbose_name="جمع ردیف (ریال)")

    class Meta:
        verbose_name = "آیتم سفارش"
        verbose_name_plural = "آیتم‌های سفارش"
        ordering = ("id",)

    def __str__(self):
        return f"{self.title_snapshot} x{self.quantity}"


class OrderEvent(TimeStampedModel):
    """Auditable history entry. Written by service code alongside every
    order mutation -- never by a view directly."""

    class EventType(models.TextChoices):
        STATUS_CHANGE = "status_change", "تغییر وضعیت"
        PAYMENT_VERIFICATION = "payment_verification", "بررسی پرداخت"
        INVENTORY_CHANGE = "inventory_change", "تغییر موجودی"
        SHIPPING_CHANGE = "shipping_change", "تغییر ارسال"
        REFUND = "refund", "بازگشت وجه"
        COURSE_ACCESS_GRANTED = "course_access_granted", "اعطای دسترسی دوره"
        COURSE_ACCESS_REVOKED = "course_access_revoked", "ابطال دسترسی دوره"
        ADMIN_NOTE = "admin_note", "یادداشت مدیر"
        OTHER = "other", "سایر"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events", verbose_name="سفارش")
    event_type = models.CharField(max_length=30, choices=EventType.choices, db_index=True, verbose_name="نوع رویداد")
    from_status = models.CharField(max_length=30, null=True, blank=True, verbose_name="وضعیت قبلی")
    to_status = models.CharField(max_length=30, null=True, blank=True, verbose_name="وضعیت جدید")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shop_order_events",
        verbose_name="انجام‌دهنده",
        help_text="خالی یعنی رویداد سیستمی (خودکار) است.",
    )
    message = models.TextField(null=True, blank=True, verbose_name="توضیح")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="اطلاعات تکمیلی")

    class Meta:
        verbose_name = "رویداد سفارش"
        verbose_name_plural = "رویدادهای سفارش"
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=("order", "created_at"))]

    def __str__(self):
        return f"{self.order.order_number} - {self.get_event_type_display()}"


class StockReservation(TimeStampedModel):
    """Unifies physical-stock holds and course-seat holds behind one
    expiring-reservation code path -- both PhysicalProductDetail and the
    course detail tables are locked identically at checkout time."""

    class Status(models.TextChoices):
        ACTIVE = "active", "فعال"
        RELEASED = "released", "آزادشده"
        CONSUMED = "consumed", "مصرف‌شده"

    order_item = models.OneToOneField(
        OrderItem, on_delete=models.CASCADE, related_name="reservation", verbose_name="آیتم سفارش"
    )
    quantity = models.PositiveIntegerField(verbose_name="تعداد رزروشده")
    expires_at = models.DateTimeField(db_index=True, verbose_name="زمان انقضا")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True, verbose_name="وضعیت"
    )

    class Meta:
        verbose_name = "رزرو موجودی"
        verbose_name_plural = "رزروهای موجودی"
        indexes = [models.Index(fields=("status", "expires_at"))]

    def __str__(self):
        return f"رزرو #{self.pk} ({self.get_status_display()})"

    @property
    def is_expired(self) -> bool:
        return self.status == self.Status.ACTIVE and self.expires_at < timezone.now()
