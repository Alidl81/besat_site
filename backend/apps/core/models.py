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