from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import (
    ActiveModel,
    ContentWorkflowModel,
    OrderedModel,
    ScopedContentModel,
    TimeStampedModel,
)
from apps.core.utils import normalize_text

from .validators import validate_gallery_image_file


def gallery_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"gallery/items/{today:%Y/%m}/{uuid4().hex}{extension}"


class GalleryItem(
    TimeStampedModel,
    ActiveModel,
    OrderedModel,
    ScopedContentModel,
    ContentWorkflowModel,
):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان تصویر",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
    )
    summary = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیح کوتاه",
    )
    image = models.ImageField(
        upload_to=gallery_image_upload_to,
        validators=[validate_gallery_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    media_url = models.TextField(
        null=True,
        blank=True,
        verbose_name="نشانی مدیا",
        help_text="مسیر، URL یا data URL عکس/ویدیو ارسال‌شده از فرانت‌اند.",
    )
    album = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="آلبوم",
    )
    alt_text = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="متن جایگزین",
    )
    caption = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="کپشن",
    )
    event_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاریخ رویداد",
    )
    published_at = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاریخ انتشار",
    )
    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="ویژه؟",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_gallery_items",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_gallery_items",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_gallery_items",
        verbose_name="منتشرکننده",
    )

    class Meta:
        verbose_name = "آیتم گالری"
        verbose_name_plural = "آیتم‌های گالری"
        ordering = ("order", "-published_at", "-id")
        indexes = [
            models.Index(fields=("status", "published_at")),
            models.Index(fields=("scope", "status")),
            models.Index(fields=("unit", "status")),
            models.Index(fields=("is_featured", "published_at")),
            models.Index(fields=("is_active", "status")),
            models.Index(fields=("order", "id")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "summary",
            "alt_text",
            "caption",
            "media_url",
            "album",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        errors = {}

        if not self.title:
            errors["title"] = "عنوان تصویر الزامی است."

        if self.status == self.Status.PUBLISHED:
            if not self.published_at:
                errors["published_at"] = "برای انتشار تصویر، تاریخ انتشار الزامی است."

            if not self.summary:
                errors["summary"] = "برای انتشار تصویر، توضیح کوتاه الزامی است."

            if not self.image and not self.media_url:
                errors["image"] = "برای انتشار تصویر، فایل تصویر الزامی است."

            if self.unit and not self.unit.is_active:
                errors["unit"] = "تصویر منتشرشده نباید به واحد غیرفعال وصل باشد."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        if not self.slug:
            self.slug = self._generate_unique_slug()

        self.full_clean(validate_unique=True, validate_constraints=True)

        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True)

        if not base_slug:
            base_slug = "gallery-item"

        slug = base_slug
        counter = 2

        queryset = GalleryItem.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug
