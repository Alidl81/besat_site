from django.contrib import admin

from .models import Achievement


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "related_unit",
        "achievement_date",
        "is_active",
        "is_featured",
        "order",
        "updated_at",
    )
    list_editable = (
        "is_active",
        "is_featured",
        "order",
    )
    list_filter = (
        "is_active",
        "is_featured",
        "related_unit",
        "achievement_date",
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "description",
        "related_unit__title",
    )
    readonly_fields = (
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "related_unit",
    )
    date_hierarchy = "achievement_date"
    save_on_top = True

    fieldsets = (
        (
            "اطلاعات اصلی",
            {
                "fields": (
                    "is_active",
                    "title",
                    "slug",
                    "summary",
                    "description",
                    "cover_image",
                ),
            },
        ),
        (
            "ارتباط و نمایش",
            {
                "fields": (
                    "related_unit",
                    "achievement_date",
                    "is_featured",
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("related_unit", "created_by", "updated_by")
        )

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user

        obj.updated_by = request.user

        super().save_model(request, obj, form, change)