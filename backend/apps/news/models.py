from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text



class NewsCategory(ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان دسته بندی",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="برای فیلتر کردن خبرها استفاده میشود. اگر خالی بماند، از عنوان ساخته میشود.",
    )

    class Meta:
        verbose_name = "دسته بندی خبر"
        verbose_name_plural = "دسته بندی های خبر"
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
    

class News(TimeStampedModel):
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
    summery = models.TextField(
        null=True,
        blank=True,
        verbose_name="خلاصه خبر",
    )
    content = models.TextField(
        null=True,
        blank=True,
        verbose_name="متن کامل خبر",
    )
    cover_image = models.ImageField(
        upload_to="news/covers/",
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )
    published_at = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاریخ انتشار",
        help_text="باید تاریخ واقعی انتشار باشد. اگر خبر منتشر نشده، خالی بگذارید.",
    )
    is_published = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="منتشر شده؟",
    )
    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="خبر ویژه؟",
    )

    class Meta:
        verbose_name = "خبر"
        verbose_name_plural = "اخبار و اطلاعیه‌ها"
        ordering = ("-published_at", "-id")
        indexes = [
            models.Index(fields=("is_published", "published_at")),
            models.Index(fields=("is_featured", "published_at")),
            models.Index(fields=("category", "is_published")),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "summary",
            "content",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        errors = {}

        if self.is_published:
            if not self.published_at:
                errors["published_at"] = "برای انتشار خبر، تاریخ انتشار الزامی است."

            if not self.summary:
                errors["summary"] = "برای انتشار خبر، خلاصه خبر الزامی است."

            if not self.content:
                errors["content"] = "برای انتشار خبر، متن کامل خبر الزامی است."

            if self.category and not self.category.is_active:
                errors["category"] = "خبر منتشرشده نباید در دسته‌بندی غیرفعال باشد."

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