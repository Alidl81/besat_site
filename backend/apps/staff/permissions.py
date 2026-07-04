from rest_framework.permissions import BasePermission

from apps.accounts.models import UserProfile, UserUnitMembership
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


def is_unit_manager(user) -> bool:
    if is_general_manager(user):
        return False

    if not user_has_active_profile(user):
        return False

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.UNIT_MANAGER


def get_unit_manager_unit_ids(user) -> list[int]:
    if not user_has_active_profile(user):
        return []

    return list(
        UserUnitMembership.objects.filter(
            user=user,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
            unit__is_active=True,
        ).values_list("unit_id", flat=True)
    )


class HasStaffCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if is_general_manager(request.user):
            return True

        if is_unit_manager(request.user):
            return True

        return False

    def has_object_permission(self, request, view, obj) -> bool:
        if is_general_manager(request.user):
            return True

        if not is_unit_manager(request.user):
            return False

        return obj.scope == obj.Scope.UNIT and obj.unit_id in get_unit_manager_unit_ids(request.user)