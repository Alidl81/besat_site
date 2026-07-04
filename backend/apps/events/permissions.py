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


def is_unit_media(user) -> bool:
    if is_general_manager(user):
        return False

    if not user_has_active_profile(user):
        return False

    profile = get_or_create_user_profile(user)

    return profile.role == UserProfile.Role.UNIT_MEDIA


def get_user_unit_ids(user, roles=None) -> list[int]:
    if not user_has_active_profile(user):
        return []

    queryset = UserUnitMembership.objects.filter(
        user=user,
        is_active=True,
        unit__is_active=True,
    )

    if roles:
        queryset = queryset.filter(role__in=roles)

    return list(queryset.values_list("unit_id", flat=True))


def can_access_unit_content(user, unit_id: int | None) -> bool:
    if is_general_manager(user):
        return True

    if not unit_id:
        return False

    accessible_unit_ids = get_user_unit_ids(
        user,
        roles=[
            UserUnitMembership.UnitRole.UNIT_MANAGER,
            UserUnitMembership.UnitRole.UNIT_MEDIA,
        ],
    )

    return unit_id in accessible_unit_ids


class HasEventCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False

        if is_general_manager(request.user):
            return True

        if is_unit_manager(request.user):
            return True

        if is_unit_media(request.user):
            return True

        return False

    def has_object_permission(self, request, view, obj) -> bool:
        return can_access_unit_content(request.user, obj.unit_id)