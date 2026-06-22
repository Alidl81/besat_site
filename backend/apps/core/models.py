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