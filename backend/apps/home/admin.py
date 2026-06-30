from django.contrib import admin

from .models import HomeSlide


@admin.register(HomeSlide)
class HomeSlideAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "is_active",
        "order",
        "href",
        "updated_at",
    )
    list_editable = (
        "is_active",
        "order",
    )
    search_fields = (
        "title",
        "subtitle",
        "alt_text",
        "href",
    )
    readonly_fields = (
        "created_by",
        "updated_by",
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
                    "subtitle",
                    "image",
                    "alt_text",
                    "href",
                    "order",
                ),
            },
        ),
        (
            "کاربران",
            {
                "fields": (
                    "created_by",
                    "updated_by",
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

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user

        obj.updated_by = request.user

        super().save_model(request, obj, form, change)