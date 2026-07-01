from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import ActiveModel, OrderedModel, ScopedContentModel, TimeStampedModel
from apps.core.utils import normalize_text
from apps.departments.models import Department

from .validators import validate_staff_image_file


def staff_avatar_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"staff/avatars/{today:%Y/%m}/{uuid4().hex}{extension}"


class StaffMember(TimeStampedModel, ActiveModel, OrderedModel, ScopedContentModel):
    class StaffType(models.TextChoices):
        MANAGER = "manager", "مدیریت"
        TEACHER = "teacher", "معلم"
        ADVISOR = "advisor", "مشاور"
        ADMINISTRATIVE = "administrative", "اداری"
        SUPPORT = "support", "پشتیبانی"
        OTHER = "other", "سایر"

    full_name = models.CharField(
        max_length=255,
        verbose_name="نام و نام خانوادگی",
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        allow_unicode=True,
        blank=True,
        verbose_name="اسلاگ",
    )
    staff_type = models.CharField(
        max_length=30,
        choices=StaffType.choices,
        default=StaffType.TEACHER,
        db_index=True,
        verbose_name="نوع عضو کادر",
    )
    role_title = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان نقش",
        help_text="مثلاً مدیر مدرسه، معلم ریاضی، معاون آموزشی",
    )
    bio = models.TextField(
        null=True,
        blank=True,
        verbose_name="معرفی کوتاه",
    )
    avatar = models.ImageField(
        upload_to=staff_avatar_upload_to,
        validators=[validate_staff_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر",
    )
    email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="ایمیل",
    )
    phone = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="شماره تماس",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_members",
        verbose_name="دپارتمان",
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
        related_name="created_staff_members",
        verbose_name="ایجادکننده",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_staff_members",
        verbose_name="آخرین ویرایش‌کننده",
    )

    class Meta:
        verbose_name = "عضو کادر"
        verbose_name_plural = "کادر مدرسه"
        ordering = ("order", "full_name", "-id")
        indexes = [
            models.Index(fields=("is_active", "order")),
            models.Index(fields=("scope", "unit", "is_active")),
            models.Index(fields=("staff_type", "is_active")),
            models.Index(fields=("department", "is_active")),
            models.Index(fields=("is_featured", "order")),
        ]

    def __str__(self):
        return self.full_name

    def clean(self):
        super().clean()

        self.full_name = normalize_text(self.full_name)
        self.slug = normalize_text(self.slug)

        nullable_text_fields = (
            "role_title",
            "bio",
            "email",
            "phone",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        if self.email:
            self.email = self.email.lower()

        errors = {}

        if not self.full_name:
            errors["full_name"] = "نام و نام خانوادگی الزامی است."

        if self.scope == self.Scope.UNIT:
            if not self.unit_id:
                errors["unit"] = "برای عضو کادر واحدی، انتخاب واحد الزامی است."
            elif not self.unit.is_active:
                errors["unit"] = "عضو کادر فعال نباید به واحد غیرفعال متصل باشد."

        if self.scope == self.Scope.SCHOOL and self.unit_id:
            errors["unit"] = "برای عضو کادر مدرسه‌ای نباید واحد انتخاب شود."

        if self.department_id and not self.department.is_active:
            errors["department"] = "دپارتمان انتخاب‌شده فعال نیست."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        if not self.slug:
            self.slug = self._generate_unique_slug()

        self.full_clean(validate_unique=True, validate_constraints=True)

        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.full_name, allow_unicode=True)

        if not base_slug:
            base_slug = "staff"

        slug = base_slug
        counter = 2

        queryset = StaffMember.objects.all()

        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug