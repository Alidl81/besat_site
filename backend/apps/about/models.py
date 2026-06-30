from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ActiveModel, TimeStampedModel
from apps.core.utils import normalize_text


def about_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()
    return f"about/{today:%Y/%m}/{uuid4().hex}{extension}"


class AboutPage(TimeStampedModel, ActiveModel):
    title = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    image = models.ImageField(
        upload_to=about_image_upload_to,
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    meta_description = models.CharField(
        max_length=300,
        null=True,
        blank=True,
        verbose_name="توضیحات متا",
    )

    class Meta:
        verbose_name = "صفحه درباره ما"
        verbose_name_plural = "صفحه درباره ما"
        ordering = ("-is_active", "-updated_at", "-id")

    def __str__(self):
        return self.title or "درباره ما"

    def clean(self):
        super().clean()

        nullable_text_fields = (
            "title",
            "description",
            "meta_description",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        if self.is_active:
            active_queryset = AboutPage.objects.filter(is_active=True)

            if self.pk:
                active_queryset = active_queryset.exclude(pk=self.pk)

            if active_queryset.exists():
                raise ValidationError(
                    {
                        "is_active": "فقط یک رکورد درباره ما می‌تواند فعال باشد.",
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)