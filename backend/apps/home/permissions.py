from rest_framework.permissions import BasePermission

from apps.accounts.models import UserProfile
from apps.accounts.selectors import get_or_create_user_profile


def user_has_active_profile(user) -> bool:
    if not user or not user.is_authenticated:
        return False

    if not user.is_active:
        return False

    profile = get_or_create_user_profile(user)

    return profile.is_active


def is_general_manager(user) -> bool:
    if not user_has_active_profile(user):
        return False

    if user.is_superuser:
        return True

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.GENERAL_MANAGER


class HasHomeSlideCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        return is_general_manager(request.user)