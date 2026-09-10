from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import UserInvitation, UserProfile, UserUnitMembership
from .serializers import revoke_all_outstanding_tokens

User = get_user_model()


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Stock ``UserAdmin`` plus one hook: AUTH-001-ADMIN.

    Django's own admin exposes a "change password" form for any user at
    ``/admin/auth/user/<id>/password/`` (``user_change_password``, wired up
    by ``UserAdmin.get_urls()``). A superuser resetting another user's
    password there is exactly the "recover a compromised account" scenario
    that ``ChangePasswordSerializer``/``SetPasswordSerializer`` already
    handle for the self-service and invitation-based reset paths (see
    AUTH-001) -- but this stock admin view bypasses both serializers
    entirely, so without this override a session an attacker already holds
    survives even an administrator-initiated password reset.

    We don't reimplement the reset itself: call the base implementation
    (unchanged validation/save/redirect behavior) and, only once it reports
    success (a POST that redirected), revoke every outstanding refresh
    token for the target user via the same unlocked
    ``revoke_all_outstanding_tokens()`` helper the other reset paths use.
    No extra locking here -- this isn't AUTH-001's concurrent-race scope,
    just making sure the revoke call fires on every successful admin
    password change.
    """

    def user_change_password(self, request, id, form_url=""):
        response = super().user_change_password(request, id, form_url)
        if request.method == "POST" and getattr(response, "status_code", None) == 302:
            user = self.get_object(request, unquote(str(id)))
            if user is not None:
                revoke_all_outstanding_tokens(user)
        return response


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


@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "created_by",
        "created_at",
        "expires_at",
        "used_at",
    )
    list_filter = (
        "used_at",
    )
    search_fields = (
        "user__username",
        "user__email",
        "created_by__username",
    )
    readonly_fields = (
        "user",
        "created_by",
        "token_hash",
        "created_at",
        "updated_at",
        "expires_at",
        "used_at",
    )
    autocomplete_fields = (
        "user",
        "created_by",
    )

    def has_add_permission(self, request):
        return False


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