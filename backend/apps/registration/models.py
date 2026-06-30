from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import ActiveModel, TimeStampedModel
from apps.core.utils import normalize_text
from apps.units.models import SchoolUnit


class RegistrationInfo(TimeStampedModel, ActiveModel):
    title = models.CharField(
        max_length=255,
        default="پیش‌ثبت‌نام",
        verbose_name="عنوان",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    is_open = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="ثبت‌نام باز است؟",
    )
    open_message = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="پیام زمان باز بودن ثبت‌نام",
    )
    closed_message = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="پیام زمان بسته بودن ثبت‌نام",
    )
    required_documents = models.JSONField(
        default=list,
        blank=True,
        verbose_name="مدارک مورد نیاز",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات تکمیلی",
    )

    class Meta:
        verbose_name = "اطلاعات ثبت‌نام"
        verbose_name_plural = "اطلاعات ثبت‌نام"
        ordering = ("-is_active", "-updated_at", "-id")

    def __str__(self):
        return self.title or "اطلاعات ثبت‌نام"

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)

        nullable_text_fields = (
            "description",
            "open_message",
            "closed_message",
            "notes",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        if self.required_documents is None:
            self.required_documents = []

        if not isinstance(self.required_documents, list):
            raise ValidationError(
                {
                    "required_documents": "مدارک مورد نیاز باید به صورت لیست ذخیره شود.",
                }
            )

        if self.is_active:
            active_queryset = RegistrationInfo.objects.filter(is_active=True)

            if self.pk:
                active_queryset = active_queryset.exclude(pk=self.pk)

            if active_queryset.exists():
                raise ValidationError(
                    {
                        "is_active": "فقط یک رکورد اطلاعات ثبت‌نام می‌تواند فعال باشد.",
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class RegistrationRequest(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "جدید"
        REVIEWING = "reviewing", "در حال بررسی"
        CONTACTED = "contacted", "تماس گرفته‌شده"
        ACCEPTED = "accepted", "پذیرفته‌شده"
        REJECTED = "rejected", "ردشده"
        ARCHIVED = "archived", "آرشیوشده"

    student_full_name = models.CharField(
        max_length=255,
        verbose_name="نام و نام خانوادگی دانش‌آموز",
    )
    parent_full_name = models.CharField(
        max_length=255,
        verbose_name="نام و نام خانوادگی ولی",
    )
    parent_phone = models.CharField(
        max_length=50,
        verbose_name="شماره تماس ولی",
    )
    parent_email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="ایمیل ولی",
    )
    requested_unit = models.ForeignKey(
        SchoolUnit,
        on_delete=models.PROTECT,
        related_name="registration_requests",
        verbose_name="واحد درخواستی",
    )
    requested_grade = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="پایه درخواستی",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
        verbose_name="وضعیت",
    )
    admin_note = models.TextField(
        null=True,
        blank=True,
        verbose_name="یادداشت مدیر",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="آدرس IP",
    )
    user_agent = models.TextField(
        null=True,
        blank=True,
        verbose_name="User Agent",
    )

    class Meta:
        verbose_name = "درخواست پیش‌ثبت‌نام"
        verbose_name_plural = "درخواست‌های پیش‌ثبت‌نام"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("status", "created_at")),
            models.Index(fields=("requested_unit", "status")),
            models.Index(fields=("created_at", "id")),
        ]

    def __str__(self):
        return f"{self.student_full_name} - {self.parent_phone}"

    def clean(self):
        super().clean()

        self.student_full_name = normalize_text(self.student_full_name)
        self.parent_full_name = normalize_text(self.parent_full_name)
        self.parent_phone = normalize_text(self.parent_phone)
        self.parent_email = normalize_text(self.parent_email).lower() if self.parent_email else None
        self.requested_grade = normalize_text(self.requested_grade) if self.requested_grade else None
        self.description = normalize_text(self.description) if self.description else None
        self.admin_note = normalize_text(self.admin_note) if self.admin_note else None

        errors = {}

        if not self.student_full_name:
            errors["student_full_name"] = "نام و نام خانوادگی دانش‌آموز الزامی است."

        if not self.parent_full_name:
            errors["parent_full_name"] = "نام و نام خانوادگی ولی الزامی است."

        if not self.parent_phone:
            errors["parent_phone"] = "شماره تماس ولی الزامی است."

        if self.requested_unit_id and not self.requested_unit.is_active:
            errors["requested_unit"] = "واحد آموزشی انتخاب‌شده فعال نیست."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)