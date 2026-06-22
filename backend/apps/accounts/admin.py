from django.contrib import admin

from .models import UserProfile, UserUnitMembership



@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "full_name",
        "phone",
        "role",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "role",
        "is_active",
    )
    list_filter = (
        "role",
        "is_active",
    )
    search_fields = (
        "user__username",
        "user__email",
        "full_name",
        "phone",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "user",
    )

    fieldsets = (
        (
            "کاربر",
            {
                "fields": (
                    "user",
                    "is_active",
                    "role",
                ),
            },
        ),
        (
            "اطلاعات پروفایل",
            {
                "fields": (
                    "full_name",
                    "phone",
                    "description",
                    "avatar",
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


@admin.register(UserUnitMembership)
class UserUnitMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "unit",
        "role",
        "is_active",
        "updated_at",
    )
    list_editable = (
        "role",
        "is_active",
    )
    list_filter = (
        "role",
        "is_active",
        "unit"
    )
    search_fields = (
        "user__username",
        "user__email",
        "unit__title",
        "unit__slug",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    autocomplete_fields = (
        "user",
        "unit",
    )

    fieldsets = (
        (
            "عضویت",
            {
                "fields": (
                    "is_active",
                    "user",
                    "unit",
                    "role",
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