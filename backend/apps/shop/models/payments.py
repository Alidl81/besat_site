from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel

from .. import money
from .orders import Order


class PaymentAttempt(TimeStampedModel):
    """One row per retry -- never reused across a customer's separate
    attempts to pay for the same order."""

    class Status(models.TextChoices):
        INITIATED = "initiated", "شروع‌شده"
        REDIRECTED = "redirected", "هدایت‌شده به درگاه"
        AWAITING_CALLBACK = "awaiting_callback", "در انتظار بازگشت از درگاه"
        SUCCEEDED = "succeeded", "موفق"
        FAILED = "failed", "ناموفق"
        EXPIRED = "expired", "منقضی‌شده"
        CANCELLED = "cancelled", "لغوشده"

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="payment_attempts", verbose_name="سفارش"
    )
    provider = models.CharField(max_length=50, verbose_name="درگاه پرداخت")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.INITIATED, db_index=True, verbose_name="وضعیت"
    )
    amount_amount = models.PositiveBigIntegerField(verbose_name="مبلغ (ریال، زمان شروع)")
    currency_code = models.CharField(max_length=10, default=money.STORAGE_CURRENCY, verbose_name="واحد پول")
    idempotency_key = models.CharField(max_length=64, unique=True, verbose_name="کلید ایدمپوتنسی")
    provider_reference = models.CharField(
        max_length=255, null=True, blank=True, db_index=True, verbose_name="شناسه درگاه"
    )
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان انقضا")
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="shop_payment_attempts",
        verbose_name="شروع‌کننده",
    )

    class Meta:
        verbose_name = "تلاش پرداخت"
        verbose_name_plural = "تلاش‌های پرداخت"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("order", "status")),
            models.Index(fields=("provider_reference",)),
        ]

    def __str__(self):
        return f"{self.order.order_number} - {self.provider} - {self.get_status_display()}"


class PaymentTransaction(TimeStampedModel):
    """Callback/verification ledger. The unique constraint below is the
    hard, DB-level replay guard: a second 'verification_succeeded' row for
    the same attempt is rejected before any business logic ever runs."""

    class TransactionType(models.TextChoices):
        CALLBACK_RECEIVED = "callback_received", "دریافت بازگشت از درگاه"
        VERIFICATION_SUCCEEDED = "verification_succeeded", "تأیید موفق"
        VERIFICATION_FAILED = "verification_failed", "تأیید ناموفق"
        DUPLICATE_CALLBACK_REJECTED = "duplicate_callback_rejected", "بازگشت تکراری رد شد"

    class Result(models.TextChoices):
        SUCCESS = "success", "موفق"
        FAILURE = "failure", "ناموفق"
        REPLAY_REJECTED = "replay_rejected", "تکراری"
        AMOUNT_MISMATCH = "amount_mismatch", "عدم تطابق مبلغ"
        ORDER_MISMATCH = "order_mismatch", "عدم تطابق سفارش"

    attempt = models.ForeignKey(
        PaymentAttempt, on_delete=models.CASCADE, related_name="transactions", verbose_name="تلاش پرداخت"
    )
    transaction_type = models.CharField(
        max_length=40, choices=TransactionType.choices, db_index=True, verbose_name="نوع تراکنش"
    )
    provider_reference = models.CharField(max_length=255, null=True, blank=True, verbose_name="شناسه درگاه")
    raw_payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بدنه خام بازگشتی",
        help_text="عاری از هر گونه اطلاعات محرمانه پیش از ذخیره‌سازی.",
    )
    verified_amount_amount = models.PositiveBigIntegerField(
        null=True, blank=True, verbose_name="مبلغ تأییدشده (ریال)"
    )
    verified_currency_code = models.CharField(max_length=10, null=True, blank=True, verbose_name="واحد پول تأییدشده")
    result = models.CharField(max_length=20, choices=Result.choices, db_index=True, verbose_name="نتیجه")

    class Meta:
        verbose_name = "تراکنش پرداخت"
        verbose_name_plural = "تراکنش‌های پرداخت"
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("attempt",),
                condition=models.Q(transaction_type="verification_succeeded"),
                name="unique_successful_verification_per_attempt",
            ),
        ]
        indexes = [models.Index(fields=("attempt", "transaction_type"))]

    def __str__(self):
        return f"{self.attempt_id} - {self.get_transaction_type_display()}"
