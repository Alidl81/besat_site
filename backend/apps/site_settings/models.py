from django.db import models, transaction
from django.db.models import Q

from apps.core.models import TimeStampedModel



class SiteSettingsQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)
    
class SiteSettingsManager(models.Manager):
    def get_queryset(self):
        return SiteSettingsQuerySet(self.model, using=self._db)
    
    def active(self):
        return self.get_queryset().active()
    
    def get_active(self):
        return self.active().order_by("-updated_at", "-id").first()
    

class SiteSettings(TimeStampedModel):
    school_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="نام رسمی مدرسه",
    )
    short_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="نام کوتاه",
    )
    slogan = models.TextField(
        null=True,
        blank=True,
        verbose_name="شعار",
    )
    intro_text = models.TextField(
        null=True,
        blank=True,
        verbose_name="متن معرفی",
    )
    logo = models.ImageField(
        upload_to="site/settings/logo/",
        null=True,
        blank=True,
        verbose_name="لوگو",
    )
    favicon = models.ImageField(
        upload_to="site/settings/favicon/",
        null=True,
        blank=True,
        verbose_name="فاوآیکون",
    )
    
    hero_title = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان hero",
    )
    hero_subtitle = models.TextField(
        null=True,
        blank=True,
        verbose_name="زیر عنوان hero",
    )
    hero_image = models.ImageField(
        upload_to="site/settings/hero/",
        null=True,
        blank=True,
        verbose_name="تصویر hero"
    )

    address = models.TextField(
        null=True,
        blank=True,
        verbose_name="آدرس",
    )
    phone_primary = models.CharField(
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
        max_length=255,
        null=True,
        blank=True,
        verbose_name="ایمیل",
    )
    working_hours = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="ساعت کاری",
    )

    instagram_url = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="لینک اینستاگرام",
    )
    telegram_url = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="لینک تلگرام",
    )
    eitaa_url = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="لینک ایتا",
    )

    founded_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="سال تأسیس",
    )
    students_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="تعداد دانش‌آموزان",
    )
    staff_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="تعداد کادر آموزشی",
    )
    achievements_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="تعداد افتخارات",
    )
    units_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="تعداد واحدها",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال است؟",
    )

    objects = SiteSettingsManager()

    class Meta:
        verbose_name = "تنظیمات سایت"
        verbose_name_plural = "تنظیمات سایت"
        ordering = ["-is_active", "-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                condition=Q(is_active=True),
                name="unique_active_site_settings",
            )
        ]

    def __str__(self):
        if self.school_name:
            return self.school_name
        
        if self.short_name:
            return self.short_name

        return "تنظیمات سایت"
    
    def clean(self):
        super().clean()

        nullable_text_fields = [
            "school_name",
            "short_name",
            "slogan",
            "intro_text",
            "hero_title",
            "hero_subtitle",
            "address",
            "phone_primary",
            "phone_secondary",
            "email",
            "working_hours",
            "instagram_url",
            "telegram_url",
            "eitaa_url",
        ]

        for field_name in nullable_text_fields:
            value = getattr(self, field_name)

            if isinstance(value, str):
                value = value.strip()
                setattr(self, field_name, value or None)

    def save(self, *args, **kwargs):
        self.full_clean(validate_unique=False, validate_constraints=False)

        with transaction.atomic():
            SiteSettings.objects.filter(is_active=True).exclude(pk=self.pk).update(
                is_active=False
            )
        super().save(*args, **kwargs)

