from django.contrib import admin

from .models import SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "phone_primary",
        "email",
        "is_active",
        "updated_at",
    )
    list_filter = (
        "is_active",
    )
    search_fields = (
        "school_name",
        "short_name",
        "slogan",
        "phone_primary",
        "email",
    )
    readonly_fields = (
        "created_at",
        "uploaded_at",
    )

    fields = (
        (
            "اطلاعات اصلی",
            {
                "fileds": (
                    "is_active",
                    "school_name",
                    "short_name",
                    "slogan",
                    "intro_text",
                )
            },
        ),
        (
            "رسانه ها",
            {
                "fileds": (
                    "logo",
                    "favicon",
                    "hero_image",
                )
            },
        ),
        (
            "بخش hero صفحه اصلی",
            {
                "fileds": (
                    "hero_title",
                    "hero_subtitle",
                )
            },
        ),
        (
            "اطلاعات تماس",
            {
                "fields": (
                    "address",
                    "phone_primary",
                    "phone_secondary",
                    "email",
                    "working_hours",
                )
            },
        ),
        (
            "شبکه‌های اجتماعی",
            {
                "fields": (
                    "instagram_url",
                    "telegram_url",
                    "eitaa_url",
                )
            },
        ),
        (
             "آمارهای قابل نمایش",
            {
                "description": (
                    "اگر عددی توسط مدرسه یا مدیر پروژه تأیید نشده، آن را خالی بگذارید."
                ),
                "fields": (
                    "founded_year",
                    "students_count",
                    "staff_count",
                    "achievements_count",
                    "units_count",
                ),
            },
        ),
        (
            "تاریخ‌ها",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )