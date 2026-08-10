from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="تاریخ بروزرسانی",
    )

    class Meta:
        abstract = True


class ActiveModel(models.Model):
    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال است؟",
    )

    class Meta:
        abstract = True

class OrderedModel(models.Model):
    order = models.PositiveIntegerField(
        default=0,
        verbose_name="ترتیب نمایش",
    )

    class Meta:
        abstract = True
        ordering = ["order", "id"]

class ScopedContentModel(models.Model):
    class Scope(models.TextChoices):
        SCHOOL = "school", "کل مدرسه"
        UNIT = "unit", "واحد آموزشی"

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
        verbose_name="واحد آموزشی",
        help_text="فقط وقتی scope برابر unit است باید مقدار داشته باشد.",
    )

    class Meta:
        abstract = True

    def clean(self):
        super().clean()

        errors = {}

        if self.scope == self.Scope.SCHOOL and self.unit_id is not None:
            errors["unit"] = "برای محتوای عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if self.scope == self.Scope.UNIT and self.unit_id is None:
            errors["unit"] = "برای محتوای وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if errors:
            raise ValidationError(errors)


class SEOFieldsModel(models.Model):
    """Yoast-style on-page SEO metadata. og_image_url is a plain URL
    (populated via the existing media picker/library) rather than a new
    ImageField, since every content type using this mixin already has its
    own cover image upload path and this only needs to reference one."""

    focus_keyphrase = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="عبارت کلیدی کانونی",
    )
    seo_title = models.CharField(
        max_length=70,
        null=True,
        blank=True,
        verbose_name="عنوان سئو",
    )
    meta_description = models.CharField(
        max_length=300,
        null=True,
        blank=True,
        verbose_name="توضیحات متا",
    )
    canonical_url = models.URLField(
        max_length=2000,
        null=True,
        blank=True,
        verbose_name="نشانی کنونیکال",
    )
    og_title = models.CharField(
        max_length=95,
        null=True,
        blank=True,
        verbose_name="عنوان اشتراک‌گذاری اجتماعی",
    )
    og_description = models.CharField(
        max_length=300,
        null=True,
        blank=True,
        verbose_name="توضیح اشتراک‌گذاری اجتماعی",
    )
    og_image_url = models.TextField(
        null=True,
        blank=True,
        verbose_name="نشانی تصویر اشتراک‌گذاری",
    )
    is_indexable = models.BooleanField(
        default=True,
        verbose_name="قابل نمایه‌سازی در موتورهای جستجو",
    )
    is_followable = models.BooleanField(
        default=True,
        verbose_name="قابل دنبال‌کردن پیوندهای صفحه",
    )
    is_cornerstone = models.BooleanField(
        default=False,
        verbose_name="محتوای محوری",
    )

    SEO_FIELD_NAMES = (
        "focus_keyphrase",
        "seo_title",
        "meta_description",
        "canonical_url",
        "og_title",
        "og_description",
        "og_image_url",
        "is_indexable",
        "is_followable",
        "is_cornerstone",
    )

    class Meta:
        abstract = True

    def seo_fields_dict(self):
        return {name: getattr(self, name) for name in self.SEO_FIELD_NAMES}


class ContentWorkflowModel(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        WAITING_REVIEW = "waiting_review", "در انتظار بررسی"
        APPROVED = "approved", "تأیید شده"
        PUBLISHED = "published", "منتشر شده"
        REJECTED = "rejected", "رد شده"
        ARCHIVED = "archived", "آرشیو شده"

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        verbose_name="وضعیت",
    )

    class Meta:
        abstract = True

    @property
    def is_published(self) -> bool:
        return self.status == self.Status.PUBLISHED