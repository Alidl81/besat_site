from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel
from apps.core.utils import normalize_text

from .catalog import Product


class CourseDetailBase(models.Model):
    """Shared course fields. Not abstracted further with the OneToOneField
    itself so each concrete model can declare its own related_name."""

    class Level(models.TextChoices):
        BEGINNER = "beginner", "مقدماتی"
        INTERMEDIATE = "intermediate", "متوسط"
        ADVANCED = "advanced", "پیشرفته"

    class EnrollmentStatus(models.TextChoices):
        OPEN = "open", "باز"
        FULL = "full", "تکمیل‌ظرفیت"
        CLOSED = "closed", "بسته"

    instructor_name = models.CharField(max_length=255, null=True, blank=True, verbose_name="مدرس")
    course_type = models.CharField(max_length=255, null=True, blank=True, verbose_name="نوع دوره")
    duration_minutes = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="مدت‌زمان (دقیقه)"
    )
    capacity = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="ظرفیت", help_text="خالی یعنی بدون محدودیت ظرفیت."
    )
    enrolled_count = models.PositiveIntegerField(
        default=0,
        editable=False,
        verbose_name="تعداد ثبت‌نام‌شده",
        help_text="فقط توسط سرویس‌های بک‌اند به‌روزرسانی می‌شود.",
    )
    start_date = models.DateField(null=True, blank=True, db_index=True, verbose_name="تاریخ شروع")
    prerequisites = models.TextField(null=True, blank=True, verbose_name="پیش‌نیازها")
    level = models.CharField(
        max_length=20, choices=Level.choices, null=True, blank=True, verbose_name="سطح"
    )
    enrollment_status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.OPEN,
        db_index=True,
        verbose_name="وضعیت ثبت‌نام",
        help_text="به‌صورت خودکار بر اساس ظرفیت محاسبه می‌شود.",
    )

    class Meta:
        abstract = True

    def recompute_enrollment_status(self, *, commit: bool = True) -> None:
        if self.enrollment_status == self.EnrollmentStatus.CLOSED:
            return

        if self.capacity is not None and self.enrolled_count >= self.capacity:
            self.enrollment_status = self.EnrollmentStatus.FULL
        else:
            self.enrollment_status = self.EnrollmentStatus.OPEN

        if commit:
            self.save(update_fields=["enrollment_status", "updated_at"])


class OnlineCourseDetail(CourseDetailBase, TimeStampedModel):
    class AccessDestinationType(models.TextChoices):
        EXTERNAL_LINK = "external_link", "لینک خارجی"
        HOSTED_PAGE = "hosted_page", "صفحه اختصاصی"
        DOWNLOAD = "download", "فایل دانلودی"
        OTHER = "other", "سایر"

    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="online_course_detail",
        verbose_name="محصول",
    )
    access_duration_days = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="مدت دسترسی (روز)", help_text="خالی یعنی دسترسی نامحدود."
    )
    access_destination_type = models.CharField(
        max_length=30,
        choices=AccessDestinationType.choices,
        default=AccessDestinationType.EXTERNAL_LINK,
        verbose_name="نوع مقصد دسترسی",
    )
    access_destination_value = models.TextField(
        null=True,
        blank=True,
        verbose_name="مقصد دسترسی",
        help_text="لینک یا دستورالعمل دسترسی. هرگز به‌صورت عمومی نمایش داده نمی‌شود؛ "
        "فقط پس از پرداخت تأییدشده در CourseEnrollment کپی می‌شود.",
    )

    class Meta:
        verbose_name = "جزئیات دوره آنلاین"
        verbose_name_plural = "جزئیات دوره‌های آنلاین"

    def __str__(self):
        return f"جزئیات دوره آنلاین: {self.product.title}"

    def clean(self):
        super().clean()
        if isinstance(self.access_destination_value, str):
            self.access_destination_value = normalize_text(self.access_destination_value) or None


class InPersonCourseDetail(CourseDetailBase, TimeStampedModel):
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="in_person_course_detail",
        verbose_name="محصول",
    )
    unit = models.ForeignKey(
        "units.SchoolUnit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shop_in_person_courses",
        verbose_name="واحد آموزشی",
    )
    location_detail = models.CharField(max_length=500, null=True, blank=True, verbose_name="محل برگزاری")
    schedule_text = models.CharField(max_length=500, null=True, blank=True, verbose_name="زمان‌بندی")
    end_date = models.DateField(null=True, blank=True, verbose_name="تاریخ پایان")
    registration_deadline = models.DateField(
        null=True, blank=True, verbose_name="مهلت ثبت‌نام"
    )
    requires_enrollment_confirmation = models.BooleanField(
        default=False,
        verbose_name="نیاز به تأیید ثبت‌نام دارد؟",
        help_text="اگر فعال باشد، CourseEnrollment پس از پرداخت با وضعیت "
        "تأییدنشده ایجاد می‌شود و باید توسط مدیر تأیید شود.",
    )

    class Meta:
        verbose_name = "جزئیات دوره حضوری"
        verbose_name_plural = "جزئیات دوره‌های حضوری"

    def __str__(self):
        return f"جزئیات دوره حضوری: {self.product.title}"

    def clean(self):
        super().clean()
        for field_name in ("location_detail", "schedule_text"):
            value = getattr(self, field_name)
            if isinstance(value, str):
                setattr(self, field_name, normalize_text(value) or None)

        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "تاریخ پایان نباید قبل از تاریخ شروع باشد."})


class CourseEnrollment(TimeStampedModel):
    """Created only by backend service code after verified payment -- there
    is no client-writable creation path anywhere in this app."""

    class Status(models.TextChoices):
        ACTIVE = "active", "فعال"
        COMPLETED = "completed", "تکمیل‌شده"
        CANCELLED = "cancelled", "لغوشده"
        REVOKED = "revoked", "ابطال‌شده"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="course_enrollments",
        verbose_name="کاربر (خریدار)",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="enrollments",
        verbose_name="دوره",
    )
    order_item = models.OneToOneField(
        "shop.OrderItem",
        on_delete=models.PROTECT,
        related_name="course_enrollment",
        verbose_name="آیتم سفارش",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="وضعیت",
    )
    is_confirmed = models.BooleanField(
        default=True,
        verbose_name="تأییدشده؟",
        help_text="برای دوره‌های حضوری با نیاز به تأیید، پس از پرداخت False می‌شود.",
    )
    access_url = models.TextField(null=True, blank=True, verbose_name="لینک دسترسی")
    access_notes = models.TextField(null=True, blank=True, verbose_name="توضیحات دسترسی")
    access_expires_at = models.DateTimeField(null=True, blank=True, verbose_name="انقضای دسترسی")
    granted_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ اعطای دسترسی")
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_course_enrollments",
        verbose_name="اعطاکننده",
        help_text="خالی یعنی به‌صورت خودکار توسط سیستم اعطا شده است.",
    )
    revoked_at = models.DateTimeField(null=True, blank=True, verbose_name="تاریخ ابطال")
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revoked_course_enrollments",
        verbose_name="ابطال‌کننده",
    )

    class Meta:
        verbose_name = "ثبت‌نام دوره"
        verbose_name_plural = "ثبت‌نام‌های دوره"
        ordering = ("-granted_at", "-id")
        indexes = [
            models.Index(fields=("user", "status")),
            models.Index(fields=("product", "status")),
        ]

    def __str__(self):
        return f"{self.user} - {self.product.title}"
