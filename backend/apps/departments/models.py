from django.db import models
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text


class DepartmentQuerrySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)
    
class DepartmentManager(models.Manager):
    def get_queryset(self):
        return DepartmentQuerrySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()


class Department(TimeStampedModel, ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان دپارتمان",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="برای URL صفحه جزئیات استفاده می‌شود. اگر خالی بماند، از عنوان ساخته می‌شود.",
    )
    short_description = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="توضیح کوتاه",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات کامل",
    )
    icon = models.FileField(
        upload_to="departments/icons/",
        null=True,
        blank=True,
        verbose_name="آیکون",
        help_text="می‌تواند SVG، PNG یا فایل تصویری معتبر باشد. اگر آیکون تأییدشده ندارید، خالی بگذارید.",
    )
    cover_image = models.ImageField(
        upload_to="departments/covers/",
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )

    objects = DepartmentManager()

    class Meta:
        verbose_name = "دپارتمان"
        verbose_name_plural = "دپارتمان‌ها"
        ordering = ("order", "id")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "short_description",
            "description",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        if not self.slug:
            self.slug = self._generate_unique_slug()

        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True)

        if not base_slug:
            base_slug = "department"

        slug = base_slug
        counter = 2

        queryset = Department.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug