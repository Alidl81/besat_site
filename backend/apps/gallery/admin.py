from django.contrib import admin

from .models import GalleryItem


@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "scope",
        "unit",
        "status",
        "published_at",
        "event_date",
        "is_active",
        "is_featured",
        "order",
        "updated_at",
    )
    list_editable = (
        "status",
        "is_active",
        "is_featured",
        "order",
    )
    list_filter = (
        "scope",
        "unit",
        "status",
        "is_active",
        "is_featured",
        "published_at",
        "event_date",
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "alt_text",
        "caption",
        "unit__title",
    )
    readonly_fields = (
        "created_by",
        "updated_by",
        "published_by",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "unit",
    )
    date_hierarchy = "published_at"
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
                    "alt_text",
                    "caption",
                ),
            },
        ),
        (
            "محدوده انتشار",
            {
                "fields": (
                    "scope",
                    "unit",
                ),
            },
        ),
        (
            "تصویر",
            {
                "fields": (
                    "image",
                ),
            },
        ),
        (
            "انتشار",
            {
                "fields": (
                    "status",
                    "published_at",
                    "event_date",
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
                    "published_by",
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
            .select_related("unit", "created_by", "updated_by", "published_by")
        )

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user

        obj.updated_by = request.user

        if obj.status == GalleryItem.Status.PUBLISHED and obj.published_by_id is None:
            obj.published_by = request.user

        super().save_model(request, obj, form, change)