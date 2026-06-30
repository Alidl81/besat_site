from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text

from .validators import validate_home_slide_image_file


def home_slide_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"home/slides/{today:%Y/%m}/{uuid4().hex}{extension}"


class HomeSlide(TimeStampedModel, ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان",
    )
    subtitle = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="زیرعنوان",
    )
    image = models.ImageField(
        upload_to=home_slide_image_upload_to,
        validators=[validate_home_slide_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    alt_text = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="متن جایگزین",
    )
    href = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="لینک",
        help_text="می‌تواند مسیر داخلی مثل /about یا لینک کامل باشد.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_home_slides",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_home_slides",
        verbose_name="آخرین ویرایش‌کننده",
    )

    class Meta:
        verbose_name = "اسلاید صفحه اصلی"
        verbose_name_plural = "اسلایدهای صفحه اصلی"
        ordering = ("order", "-id")
        indexes = [
            models.Index(fields=("is_active", "order")),
            models.Index(fields=("order", "id")),
        ]

    def __str__(self):
        return self.title or f"اسلاید {self.pk or ''}".strip()

    def clean(self):
        super().clean()

        nullable_text_fields = (
            "title",
            "subtitle",
            "alt_text",
            "href",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        errors = {}

        if self.is_active and not self.image:
            errors["image"] = "برای فعال بودن اسلاید، تصویر الزامی است."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)