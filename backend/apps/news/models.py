from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text

from .utils import (
    default_news_content_json,
    extract_editorjs_plain_text,
    validate_editorjs_content,
)
from .validators import validate_news_image_file


def news_cover_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"news/covers/{today:%Y/%m}/{uuid4().hex}{extension}"


def news_content_image_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"news/content/{today:%Y/%m}/{uuid4().hex}{extension}"


class NewsCategory(ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان دسته‌بندی",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="برای فیلتر کردن خبرها استفاده می‌شود. اگر خالی بماند، از عنوان ساخته می‌شود.",
    )

    class Meta:
        verbose_name = "دسته‌بندی خبر"
        verbose_name_plural = "دسته‌بندی‌های خبر"
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
            base_slug = "news-category"

        slug = base_slug
        counter = 2

        queryset = NewsCategory.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class News(TimeStampedModel, ActiveModel):
    class Scope(models.TextChoices):
        SCHOOL = "school", "کل مدرسه"
        UNIT = "unit", "واحد آموزشی"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        WAITING_REVIEW = "waiting_review", "در انتظار بررسی"
        APPROVED = "approved", "تأیید شده"
        PUBLISHED = "published", "منتشر شده"
        REJECTED = "rejected", "رد شده"
        ARCHIVED = "archived", "آرشیو شده"

    title = models.CharField(
        max_length=255,
        verbose_name="عنوان خبر",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="برای URL صفحه جزئیات استفاده می‌شود. اگر خالی بماند، از عنوان ساخته می‌شود.",
    )
    category = models.ForeignKey(
        NewsCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_items",
        verbose_name="دسته‌بندی",
    )
    scope = models.CharField(
        max_length=20,
        choices=Scope.choices,
        default=Scope.SCHOOL,
        db_index=True,
        verbose_name="محدوده انتشار",
    )
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_items",
        verbose_name="واحد آموزشی",
        help_text="فقط وقتی scope برابر unit است باید مقدار داشته باشد.",
    )
    summary = models.TextField(
        null=True,
        blank=True,
        verbose_name="خلاصه خبر",
    )
    cover_image = models.ImageField(
        upload_to=news_cover_upload_to,
        validators=[validate_news_image_file],
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
        default=default_news_content_json,
        blank=True,
        verbose_name="محتوای ساختاریافته",
        help_text="خروجی JSON ادیتور خبر. برای نمایش در فرانت استفاده می‌شود.",
    )
    content_text = models.TextField(
        null=True,
        blank=True,
        editable=False,
        db_index=True,
        verbose_name="متن ساده برای جستجو",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        verbose_name="وضعیت",
    )
    published_at = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاریخ انتشار",
        help_text="برای نمایش عمومی خبر، تاریخ انتشار باید واقعی و امروز یا قبل‌تر باشد.",
    )
    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="خبر ویژه؟",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_news_items",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_news_items",
        verbose_name="آخرین ویرایش‌کننده",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_news_items",
        verbose_name="منتشرکننده",
    )

    class Meta:
        verbose_name = "خبر"
        verbose_name_plural = "اخبار و اطلاعیه‌ها"
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

    @property
    def is_published(self) -> bool:
        return self.status == self.Status.PUBLISHED

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
            errors["title"] = "عنوان خبر الزامی است."

        if self.scope == self.Scope.SCHOOL and self.unit_id is not None:
            errors["unit"] = "برای محتوای عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if self.scope == self.Scope.UNIT and self.unit_id is None:
            errors["unit"] = "برای محتوای وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if self.status == self.Status.PUBLISHED:
            if not self.published_at:
                errors["published_at"] = "برای انتشار خبر، تاریخ انتشار الزامی است."

            if not self.summary:
                errors["summary"] = "برای انتشار خبر، خلاصه خبر الزامی است."

            if not self.content_text:
                errors["content_json"] = "برای انتشار خبر، متن خبر الزامی است."

            if self.category and not self.category.is_active:
                errors["category"] = "خبر منتشرشده نباید در دسته‌بندی غیرفعال باشد."

            if self.unit and not self.unit.is_active:
                errors["unit"] = "خبر منتشرشده نباید به واحد غیرفعال وصل باشد."

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
            base_slug = "news"

        slug = base_slug
        counter = 2

        queryset = News.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class NewsMedia(models.Model):
    news = models.ForeignKey(
        News,
        on_delete=models.CASCADE,
        related_name="media_items",
        verbose_name="خبر",
    )
    image = models.ImageField(
        upload_to=news_content_image_upload_to,
        validators=[validate_news_image_file],
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
        related_name="uploaded_news_media",
        verbose_name="آپلودکننده",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ آپلود",
    )

    class Meta:
        verbose_name = "رسانه خبر"
        verbose_name_plural = "رسانه‌های خبر"
        ordering = ("-created_at", "-id")

    def __str__(self):
        return self.caption or self.alt_text or f"تصویر خبر #{self.pk}"

    def clean(self):
        super().clean()

        if isinstance(self.alt_text, str):
            self.alt_text = normalize_text(self.alt_text) or None

        if isinstance(self.caption, str):
            self.caption = normalize_text(self.caption) or None
