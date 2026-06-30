from django.contrib import admin

from .models import ContactInfo, ContactMessage


@admin.register(ContactInfo)
class ContactInfoAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "phone",
        "email",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "is_active",
    )
    search_fields = (
        "title",
        "address",
        "phone",
        "email",
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
                    "description",
                ),
            },
        ),
        (
            "راه‌های ارتباطی",
            {
                "fields": (
                    "address",
                    "phone",
                    "phone_secondary",
                    "email",
                    "working_hours",
                ),
            },
        ),
        (
            "نقشه",
            {
                "fields": (
                    "map_url",
                    "latitude",
                    "longitude",
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


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "phone",
        "email",
        "subject",
        "status",
        "created_at",
    )
    list_editable = (
        "status",
    )
    list_filter = (
        "status",
        "created_at",
    )
    search_fields = (
        "full_name",
        "phone",
        "email",
        "subject",
        "message",
    )
    readonly_fields = (
        "full_name",
        "phone",
        "email",
        "subject",
        "message",
        "ip_address",
        "user_agent",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "اطلاعات فرستنده",
            {
                "fields": (
                    "full_name",
                    "phone",
                    "email",
                ),
            },
        ),
        (
            "پیام",
            {
                "fields": (
                    "subject",
                    "message",
                ),
            },
        ),
        (
            "وضعیت رسیدگی",
            {
                "fields": (
                    "status",
                    "admin_note",
                ),
            },
        ),
        (
            "اطلاعات فنی",
            {
                "fields": (
                    "ip_address",
                    "user_agent",
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

    def has_add_permission(self, request):
        return False