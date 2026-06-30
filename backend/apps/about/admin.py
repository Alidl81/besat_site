from django.contrib import admin

from .models import AboutPage


@admin.register(AboutPage)
class AboutPageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "is_active",
    )
    search_fields = (
        "title",
        "description",
        "meta_description",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "محتوا",
            {
                "fields": (
                    "is_active",
                    "title",
                    "description",
                    "image",
                    "meta_description",
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