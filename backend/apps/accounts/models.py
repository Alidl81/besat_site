from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ActiveModel, TimeStampedModel
from apps.core.utils import normalize_text

from .validators import validate_avatar_image_file


def user_avatar_upload_to(instance, filename):
    today = timezone.localdate()
    extension = Path(filename).suffix.lower()

    return f"accounts/avatars/{today:%Y/%m}/{uuid4().hex}{extension}"


class UserProfile(TimeStampedModel, ActiveModel):
    class Role(models.TextChoices):
        GENERAL_MANAGER = "general_manager", "مدیر کل"
        UNIT_MANAGER = "unit_manager", "مدیر واحد"
        UNIT_MEDIA = "unit_media", "مسئول رسانه واحد"
        PARENT = "parent", "والد"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="کاربر",
    )
    full_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="نام کامل",
    )
    phone = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="شماره تماس",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    avatar = models.ImageField(
        upload_to=user_avatar_upload_to,
        validators=[validate_avatar_image_file],
        null=True,
        blank=True,
        verbose_name="تصویر پروفایل",
    )
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.PARENT,
        db_index=True,
        verbose_name="نقش",
    )

    class Meta:
        verbose_name = "پروفایل کاربر"
        verbose_name_plural = "پروفایل کاربران"
        indexes = [
            models.Index(fields=("role", "is_active")),
        ]

    def __str__(self):
        return self.full_name or self.user.get_username()

    def clean(self):
        super().clean()

        nullable_text_fields = (
            "full_name",
            "phone",
            "description",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)


class UserUnitMembership(TimeStampedModel, ActiveModel):
    class UnitRole(models.TextChoices):
        UNIT_MANAGER = "unit_manager", "مدیر واحد"
        UNIT_MEDIA = "unit_media", "مسئول رسانه واحد"
        PARENT = "parent", "والد"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="unit_memberships",
        verbose_name="کاربر",
    )
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.CASCADE,
        related_name="user_memberships",
        verbose_name="واحد آموزشی",
    )
    role = models.CharField(
        max_length=30,
        choices=UnitRole.choices,
        db_index=True,
        verbose_name="نقش در واحد",
    )

    class Meta:
        verbose_name = "عضویت کاربر در واحد"
        verbose_name_plural = "عضویت کاربران در واحدها"
        ordering = ("unit__order", "unit__id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("user", "unit", "role"),
                name="unique_user_unit_role_membership",
            )
        ]
        indexes = [
            models.Index(fields=("user", "role", "is_active")),
            models.Index(fields=("unit", "role", "is_active")),
        ]

    def __str__(self):
        return f"{self.user} - {self.unit} - {self.get_role_display()}"

    def clean(self):
        super().clean()

        errors = {}

        profile = getattr(self.user, "profile", None)

        if profile and profile.role == UserProfile.Role.GENERAL_MANAGER:
            errors["user"] = "مدیر کل نیازی به عضویت واحدی ندارد."

        if self.unit_id and not self.unit.is_active:
            errors["unit"] = "عضویت در واحد غیرفعال مجاز نیست."

        if errors:
            raise ValidationError(errors)