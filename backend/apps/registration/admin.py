from django.contrib import admin

from .models import RegistrationInfo, RegistrationRequest


@admin.register(RegistrationInfo)
class RegistrationInfoAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "is_open",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "is_open",
        "is_active",
    )
    search_fields = (
        "title",
        "description",
        "notes",
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
                    "is_open",
                ),
            },
        ),
        (
            "پیام‌ها",
            {
                "fields": (
                    "open_message",
                    "closed_message",
                ),
            },
        ),
        (
            "مدارک و توضیحات",
            {
                "fields": (
                    "required_documents",
                    "notes",
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


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    list_display = (
        "student_full_name",
        "parent_full_name",
        "parent_phone",
        "requested_unit",
        "requested_grade",
        "status",
        "created_at",
    )
    list_editable = (
        "status",
    )
    list_filter = (
        "status",
        "requested_unit",
        "created_at",
    )
    search_fields = (
        "student_full_name",
        "parent_full_name",
        "parent_phone",
        "parent_email",
        "requested_grade",
        "description",
    )
    readonly_fields = (
        "student_full_name",
        "parent_full_name",
        "parent_phone",
        "parent_email",
        "requested_unit",
        "requested_grade",
        "description",
        "ip_address",
        "user_agent",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "requested_unit",
    )
    fieldsets = (
        (
            "اطلاعات دانش‌آموز",
            {
                "fields": (
                    "student_full_name",
                    "requested_unit",
                    "requested_grade",
                ),
            },
        ),
        (
            "اطلاعات ولی",
            {
                "fields": (
                    "parent_full_name",
                    "parent_phone",
                    "parent_email",
                ),
            },
        ),
        (
            "توضیحات",
            {
                "fields": (
                    "description",
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