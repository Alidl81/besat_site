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

from .validators import validate_event_image_file


def event_cover_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"events/covers/{today:%Y/%m}/{uuid4().hex}{extension}"


class Event(
    TimeStampedModel,
    ActiveModel,
    OrderedModel,
    ScopedContentModel,
    ContentWorkflowModel,
):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان رویداد",
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
        verbose_name="خلاصه",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    cover_image = models.ImageField(
        upload_to=event_cover_upload_to,
        validators=[validate_event_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )
    alt_text = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="متن جایگزین تصویر",
    )
    location = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="محل برگزاری",
    )
    event_start_at = models.DateTimeField(
        db_index=True,
        verbose_name="زمان شروع رویداد",
    )
    event_end_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان پایان رویداد",
    )
    registration_url = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="لینک ثبت‌نام یا اطلاعات بیشتر",
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
    review_note = models.TextField(
        null=True,
        blank=True,
        verbose_name="یادداشت بررسی",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_events",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_events",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_events",
        verbose_name="منتشرکننده",
    )

    class Meta:
        verbose_name = "رویداد"
        verbose_name_plural = "رویدادها"
        ordering = ("event_start_at", "order", "-id")
        indexes = [
            models.Index(fields=("status", "published_at")),
            models.Index(fields=("scope", "unit", "status")),
            models.Index(fields=("event_start_at", "id")),
            models.Index(fields=("is_featured", "event_start_at")),
            models.Index(fields=("is_active", "status")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "summary",
            "description",
            "alt_text",
            "location",
            "registration_url",
            "review_note",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        errors = {}

        if not self.title:
            errors["title"] = "عنوان رویداد الزامی است."

        if self.event_end_at and self.event_end_at <= self.event_start_at:
            errors["event_end_at"] = "زمان پایان رویداد باید بعد از زمان شروع باشد."

        if self.status == self.Status.PUBLISHED:
            if not self.published_at:
                errors["published_at"] = "برای انتشار رویداد، تاریخ انتشار الزامی است."

            if not self.summary:
                errors["summary"] = "برای انتشار رویداد، خلاصه الزامی است."

            if not self.description:
                errors["description"] = "برای انتشار رویداد، توضیحات الزامی است."

        if self.scope == self.Scope.UNIT:
            if not self.unit_id:
                errors["unit"] = "برای رویداد واحدی، انتخاب واحد الزامی است."

            elif not self.unit.is_active:
                errors["unit"] = "رویداد فعال یا قابل انتشار نباید به واحد غیرفعال متصل باشد."

        if self.scope == self.Scope.SCHOOL and self.unit_id:
            errors["unit"] = "برای رویداد مدرسه‌ای نباید واحد انتخاب شود."

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
            base_slug = "event"

        slug = base_slug
        counter = 2

        queryset = Event.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug