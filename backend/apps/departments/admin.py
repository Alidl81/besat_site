from django.contrib import admin

from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
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
        "short_description",
        "description",
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
                    "short_description",
                    "description",
                ),
            },
        ),
        (
            "رسانه",
            {
                "description": (
                    "اگر آیکون یا تصویر کاور تأییدشده ندارید، این فیلدها را خالی بگذارید. "
                    "API در این حالت مقدار null برمی‌گرداند."
                ),
                "fields": (
                    "icon",
                    "cover_image",
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