from django.db import models
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text


class SchoolUnitQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)
    

class SchoolUnitManager(models.Manager):
    def ger_queryset(self):
        return SchoolUnitQuerySet(self.model, using=self._db)
    
    def active(self):
        return self.get_queryset().active()
    

class SchoolUnit(TimeStampedModel, ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان واحد آموزشی",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
        help_text="برای URL صفحه جزئیات استفاده می‌شود. اگر خالی بماند، از عنوان ساخته می‌شود.",
    )
    subtitle = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="زیرعنوان",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    cover_image = models.ImageField(
        upload_to="units/covers/",
        null=True,
        blank=True,
        verbose_name="تصویر کاور",
    )
    age_range = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="بازه سنی",
    )
    grade_range = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="پایه‌های تحصیلی",
    )

    objects = SchoolUnitManager()

    class Meta:
        verbose_name = "واحد آموزشی"
        verbose_name_plural = "واحدهای آموزشی"
        ordering = ("order", "id")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "subtitle",
            "description",
            "age_range",
            "grade_range",
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
            base_slug = "school-unit"

        slug = base_slug
        counter = 2

        queryset = SchoolUnit.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug