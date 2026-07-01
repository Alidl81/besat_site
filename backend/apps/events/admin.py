from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "scope",
        "unit",
        "event_start_at",
        "status",
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
        "status",
        "scope",
        "unit",
        "is_active",
        "is_featured",
        "event_start_at",
        "published_at",
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "description",
        "location",
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
    date_hierarchy = "event_start_at"
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
                    "alt_text",
                ),
            },
        ),
        (
            "زمان و مکان",
            {
                "fields": (
                    "event_start_at",
                    "event_end_at",
                    "location",
                    "registration_url",
                ),
            },
        ),
        (
            "Scope",
            {
                "fields": (
                    "scope",
                    "unit",
                ),
            },
        ),
        (
            "وضعیت انتشار",
            {
                "fields": (
                    "status",
                    "published_at",
                    "published_by",
                    "review_note",
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
            .select_related("unit", "created_by", "updated_by", "published_by")
        )

    def save_model(self, request, obj, form, change):
        if not change and obj.created_by_id is None:
            obj.created_by = request.user

        obj.updated_by = request.user

        if obj.status == Event.Status.PUBLISHED and obj.published_by_id is None:
            obj.published_by = request.user

        super().save_model(request, obj, form, change)