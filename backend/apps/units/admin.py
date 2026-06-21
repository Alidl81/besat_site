from django.contrib import admin

from .models import SchoolUnit


@admin.register(SchoolUnit)
class SchoolUnitAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "order",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "order",
        "is_active",
    )
    list_filter = (
        "is_active",
    )
    search_fields = (
        "title",
        "slug",
        "subtitle",
        "description",
        "age_range",
        "grade_range",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "اطلاعات اصلی",
            {
                "fields": (
                    "is_active",
                    "title",
                    "slug",
                    "subtitle",
                    "description",
                ),
            },
        ),
        (
            "رسانه",
            {
                "description": (
                    "آیکون واحدهای آموزشی از لوگوی فعال سایت در بخش تنظیمات سایت خوانده می‌شود "
                    "و برای هر واحد جداگانه ذخیره نمی‌شود."
                ),
                "fields": (
                    "cover_image",
                ),
            },
        ),
        (
            "اطلاعات آموزشی",
            {
                "fields": (
                    "age_range",
                    "grade_range",
                ),
            },
        ),
        (
            "نمایش و مرتب‌سازی",
            {
                "fields": (
                    "order",
                ),
            },
        ),
        (
            "تاریخ‌ها",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )