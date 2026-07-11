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

from .utils import (
    default_announcement_content_json,
    extract_editorjs_plain_text,
    validate_editorjs_content,
)
from .validators import validate_announcement_image_file


def announcement_cover_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"announcements/covers/{today:%Y/%m}/{uuid4().hex}{extension}"


def announcement_content_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"announcements/content/{today:%Y/%m}/{uuid4().hex}{extension}"


class AnnouncementCategory(ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان دسته‌بندی اطلاعیه",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
    )

    class Meta:
        verbose_name = "دسته‌بندی اطلاعیه"
        verbose_name_plural = "دسته‌بندی‌های اطلاعیه"
        ordering = ("order", "id")
        indexes = [
            models.Index(fields=("is_active", "order")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        if not self.title:
            raise ValidationError(
                {
                    "title": "عنوان دسته‌بندی الزامی است.",
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        if not self.slug:
            self.slug = self._generate_unique_slug()

        self.full_clean(validate_unique=True, validate_constraints=True)

        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True)

        if not base_slug:
            base_slug = "announcement-category"

        slug = base_slug
        counter = 2

        queryset = AnnouncementCategory.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class Announcement(
    TimeStampedModel,
    ActiveModel,
    ScopedContentModel,
    ContentWorkflowModel,
):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان اطلاعیه",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
    )
    category = models.ForeignKey(
        AnnouncementCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements",
        verbose_name="دسته‌بندی",
    )
    summary = models.TextField(
        null=True,
        blank=True,
        verbose_name="خلاصه اطلاعیه",
    )
    cover_image = models.ImageField(
        upload_to=announcement_cover_upload_to,
        validators=[validate_announcement_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )
    cover_image_url = models.TextField(
        null=True,
        blank=True,
        verbose_name="نشانی تصویر کاور",
    )
    content_json = models.JSONField(
        default=default_announcement_content_json,
        blank=True,
        verbose_name="محتوای ساختاریافته",
    )
    content_text = models.TextField(
        null=True,
        blank=True,
        editable=False,
        db_index=True,
        verbose_name="متن ساده برای جستجو",
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
        verbose_name="اطلاعیه ویژه؟",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_announcements",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_announcements",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_announcements",
        verbose_name="منتشرکننده",
    )

    class Meta:
        verbose_name = "اطلاعیه"
        verbose_name_plural = "اطلاعیه‌ها"
        ordering = ("-published_at", "-id")
        indexes = [
            models.Index(fields=("status", "published_at")),
            models.Index(fields=("scope", "status")),
            models.Index(fields=("unit", "status")),
            models.Index(fields=("is_featured", "published_at")),
            models.Index(fields=("category", "status")),
            models.Index(fields=("is_active", "status")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        if isinstance(self.summary, str):
            self.summary = normalize_text(self.summary) or None

        if isinstance(self.cover_image_url, str):
            self.cover_image_url = self.cover_image_url.strip() or None

        self.content_json = validate_editorjs_content(self.content_json)
        self.content_text = extract_editorjs_plain_text(self.content_json) or None

        errors = {}

        if not self.title:
            errors["title"] = "عنوان اطلاعیه الزامی است."

        if self.status == self.Status.PUBLISHED:
            if not self.published_at:
                errors["published_at"] = "برای انتشار اطلاعیه، تاریخ انتشار الزامی است."

            if not self.summary:
                errors["summary"] = "برای انتشار اطلاعیه، خلاصه اطلاعیه الزامی است."

            if not self.content_text:
                errors["content_json"] = "برای انتشار اطلاعیه، متن اطلاعیه الزامی است."

            if self.category and not self.category.is_active:
                errors["category"] = "اطلاعیه منتشرشده نباید در دسته‌بندی غیرفعال باشد."

            if self.unit and not self.unit.is_active:
                errors["unit"] = "اطلاعیه منتشرشده نباید به واحد غیرفعال وصل باشد."

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
            base_slug = "announcement"

        slug = base_slug
        counter = 2

        queryset = Announcement.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class AnnouncementMedia(models.Model):
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name="media_items",
        verbose_name="اطلاعیه",
    )
    image = models.ImageField(
        upload_to=announcement_content_image_upload_to,
        validators=[validate_announcement_image_file],
        verbose_name="تصویر",
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
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_announcement_media",
        verbose_name="آپلودکننده",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ آپلود",
    )

    class Meta:
        verbose_name = "رسانه اطلاعیه"
        verbose_name_plural = "رسانه‌های اطلاعیه"
        ordering = ("-created_at", "-id")

    def __str__(self):
        return self.caption or self.alt_text or f"تصویر اطلاعیه #{self.pk}"

    def clean(self):
        super().clean()

        if isinstance(self.alt_text, str):
            self.alt_text = normalize_text(self.alt_text) or None

        if isinstance(self.caption, str):
            self.caption = normalize_text(self.caption) or None
