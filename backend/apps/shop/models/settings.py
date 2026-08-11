from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text


class ShippingMethod(TimeStampedModel, ActiveModel, OrderedModel):
    """Flat-rate only. TEMPORARY: real shipping methods/cities/fee rules
    are pending product-owner confirmation (project decision gate) --
    this exists so checkout has something concrete to compute against
    until that decision lands."""

    title = models.CharField(max_length=255, verbose_name="عنوان روش ارسال")
    description = models.CharField(max_length=500, null=True, blank=True, verbose_name="توضیحات")
    price_amount = models.PositiveBigIntegerField(default=0, verbose_name="هزینه (ریال)")
    is_default = models.BooleanField(default=False, verbose_name="روش پیش‌فرض؟")

    class Meta:
        verbose_name = "روش ارسال"
        verbose_name_plural = "روش‌های ارسال"
        ordering = ("order", "id")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        self.title = normalize_text(self.title)
        if not self.title:
            raise ValidationError({"title": "عنوان روش ارسال الزامی است."})


class ShopSettings(models.Model):
    """Singleton settings row, following the same 'exactly one active row'
    idiom used elsewhere in this codebase (e.g. RegistrationInfo) rather
    than a new get_solo()-style pattern."""

    reservation_hold_minutes = models.PositiveIntegerField(
        default=15, verbose_name="مدت رزرو موجودی (دقیقه)"
    )
    low_stock_default_threshold = models.PositiveIntegerField(
        default=5, verbose_name="آستانه پیش‌فرض موجودی کم"
    )
    mock_payment_enabled = models.BooleanField(
        default=True,
        verbose_name="درگاه پرداخت آزمایشی فعال است؟",
        help_text="تا زمان انتخاب درگاه پرداخت واقعی، فعال بماند.",
    )
    default_shipping_method = models.ForeignKey(
        ShippingMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="روش ارسال پیش‌فرض",
    )
    terms_url = models.URLField(null=True, blank=True, verbose_name="لینک قوانین و مقررات")
    refund_policy_url = models.URLField(null=True, blank=True, verbose_name="لینک قوانین بازگشت وجه")

    class Meta:
        verbose_name = "تنظیمات فروشگاه"
        verbose_name_plural = "تنظیمات فروشگاه"

    def __str__(self):
        return "تنظیمات فروشگاه"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls) -> "ShopSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
