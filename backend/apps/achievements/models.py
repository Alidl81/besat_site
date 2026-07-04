from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, TimeStampedModel
from apps.core.utils import normalize_text
from apps.units.models import SchoolUnit

from .validators import validate_achievement_image_file


def achievement_cover_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"achievements/covers/{today:%Y/%m}/{uuid4().hex}{extension}"


class Achievement(TimeStampedModel, ActiveModel, OrderedModel):
    title = models.CharField(
        max_length=255,
        verbose_name="عنوان افتخار",
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
        upload_to=achievement_cover_upload_to,
        validators=[validate_achievement_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    achievement_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاریخ کسب افتخار",
    )
    related_unit = models.ForeignKey(
        SchoolUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="achievements",
        verbose_name="واحد مرتبط",
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
        related_name="created_achievements",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_achievements",
        verbose_name="آخرین ویرایش‌کننده",
    )

    class Meta:
        verbose_name = "افتخار"
        verbose_name_plural = "افتخارات"
        ordering = ("order", "-achievement_date", "-id")
        indexes = [
            models.Index(fields=("is_active", "order")),
            models.Index(fields=("is_featured", "achievement_date")),
            models.Index(fields=("related_unit", "is_active")),
            models.Index(fields=("achievement_date", "id")),
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
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        errors = {}

        if not self.title:
            errors["title"] = "عنوان افتخار الزامی است."

        if self.is_active and self.related_unit and not self.related_unit.is_active:
            errors["related_unit"] = "افتخار فعال نباید به واحد غیرفعال متصل باشد."

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
            base_slug = "achievement"

        slug = base_slug
        counter = 2

        queryset = Achievement.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug