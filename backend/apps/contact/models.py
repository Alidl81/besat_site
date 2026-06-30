from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ActiveModel, TimeStampedModel
from apps.core.utils import normalize_text


class ContactInfo(TimeStampedModel, ActiveModel):
    title = models.CharField(
        max_length=255,
        default="تماس با ما",
        verbose_name="عنوان",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="توضیحات",
    )
    address = models.TextField(
        null=True,
        blank=True,
        verbose_name="آدرس",
    )
    phone = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="شماره تماس اصلی",
    )
    phone_secondary = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="شماره تماس دوم",
    )
    email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="ایمیل",
    )
    working_hours = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="ساعات کاری",
    )
    map_url = models.URLField(
        max_length=1000,
        null=True,
        blank=True,
        verbose_name="لینک نقشه",
    )
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name="عرض جغرافیایی",
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name="طول جغرافیایی",
    )

    class Meta:
        verbose_name = "اطلاعات تماس"
        verbose_name_plural = "اطلاعات تماس"
        ordering = ("-is_active", "-updated_at", "-id")

    def __str__(self):
        return self.title or "اطلاعات تماس"

    def clean(self):
        super().clean()

        self.title = normalize_text(self.title)

        nullable_text_fields = (
            "description",
            "address",
            "phone",
            "phone_secondary",
            "email",
            "working_hours",
            "map_url",
        )

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = normalize_text(value)
                setattr(self, field_name, value or None)

        if self.is_active:
            active_queryset = ContactInfo.objects.filter(is_active=True)

            if self.pk:
                active_queryset = active_queryset.exclude(pk=self.pk)

            if active_queryset.exists():
                raise ValidationError(
                    {
                        "is_active": "فقط یک رکورد اطلاعات تماس می‌تواند فعال باشد.",
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ContactMessage(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "جدید"
        SEEN = "seen", "دیده‌شده"
        ANSWERED = "answered", "پاسخ‌داده‌شده"
        ARCHIVED = "archived", "آرشیوشده"

    full_name = models.CharField(
        max_length=255,
        verbose_name="نام و نام خانوادگی",
    )
    phone = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="شماره تماس",
    )
    email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="ایمیل",
    )
    subject = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="موضوع",
    )
    message = models.TextField(
        verbose_name="متن پیام",
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
        verbose_name = "پیام تماس"
        verbose_name_plural = "پیام‌های تماس"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("status", "created_at")),
            models.Index(fields=("created_at", "id")),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.created_at:%Y-%m-%d}"

    def clean(self):
        super().clean()

        self.full_name = normalize_text(self.full_name)
        self.phone = normalize_text(self.phone) if self.phone else None
        self.email = normalize_text(self.email).lower() if self.email else None
        self.subject = normalize_text(self.subject) if self.subject else None
        self.admin_note = normalize_text(self.admin_note) if self.admin_note else None

        if isinstance(self.message, str):
            self.message = self.message.strip()

        errors = {}

        if not self.full_name:
            errors["full_name"] = "نام و نام خانوادگی الزامی است."

        if not self.phone and not self.email:
            errors["phone"] = "حداقل یکی از شماره تماس یا ایمیل الزامی است."
            errors["email"] = "حداقل یکی از شماره تماس یا ایمیل الزامی است."

        if not self.message:
            errors["message"] = "متن پیام الزامی است."

        if self.message and len(self.message) < 10:
            errors["message"] = "متن پیام باید حداقل ۱۰ کاراکتر باشد."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def created_date(self):
        return timezone.localdate(self.created_at)