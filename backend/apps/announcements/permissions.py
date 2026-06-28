from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.accounts.selectors import get_or_create_user_profile

from .models import Announcement, AnnouncementCategory


def user_has_active_profile(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    
    if not user.is_active:
        return False
    
    profile = get_or_create_user_profile(user)

    return profile.is_active


def get_user_role(user) -> str | None:
    if not user_has_active_profile(user):
        return None

    profile = get_or_create_user_profile(user)

    return profile.role


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

    return get_user_role(user) == UserProfile.Role.UNIT_MANAGER


def is_unit_media(user) -> bool:
    if is_general_manager(user):
        return False

    return get_user_role(user) == UserProfile.Role.UNIT_MEDIA


def is_parent(user) -> bool:
    if is_general_manager(user):
        return False

    return get_user_role(user) == UserProfile.Role.PARENT


def get_accessible_unit_ids(user, allowed_roles: tuple[str, ...] | None = None) -> list[int]:
    if not user_has_active_profile(user):
        return []

    if is_general_manager(user):
        return []

    queryset = UserUnitMembership.objects.filter(
        user=user,
        is_active=True,
        unit__is_active=True,
    )

    if allowed_roles:
        queryset = queryset.filter(role__in=allowed_roles)

    return list(queryset.values_list("unit_id", flat=True))


def user_can_access_announcement_object(user, announcement: Announcement) -> bool:
    if is_general_manager(user):
        return True

    if is_parent(user):
        return False

    if announcement.scope != Announcement.Scope.UNIT or announcement.unit_id is None:
        return False

    accessible_unit_ids = get_accessible_unit_ids(user)

    return announcement.unit_id in accessible_unit_ids


def user_can_write_announcement_object(user, announcement: Announcement) -> bool:
    if is_general_manager(user):
        return True

    if not is_unit_manager(user):
        return False

    if announcement.scope != Announcement.Scope.UNIT or announcement.unit_id is None:
        return False

    accessible_unit_ids = get_accessible_unit_ids(
        user,
        allowed_roles=(
            UserUnitMembership.UnitRole.UNIT_MANAGER,
        ),
    )

    return announcement.unit_id in accessible_unit_ids


def user_can_upload_announcement_media(user, announcement: Announcement) -> bool:
    if is_general_manager(user):
        return True

    if announcement.scope != Announcement.Scope.UNIT or announcement.unit_id is None:
        return False

    if is_unit_manager(user):
        allowed_roles = (
            UserUnitMembership.UnitRole.UNIT_MANAGER,
        )

    elif is_unit_media(user):
        allowed_roles = (
            UserUnitMembership.UnitRole.UNIT_MEDIA,
        )

    else:
        return False

    accessible_unit_ids = get_accessible_unit_ids(
        user,
        allowed_roles=allowed_roles,
    )

    return announcement.unit_id in accessible_unit_ids


class HasAnnouncementCategoryCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False

        if is_general_manager(request.user):
            return True

        if is_parent(request.user):
            return False

        if request.method in SAFE_METHODS:
            return is_unit_manager(request.user) or is_unit_media(request.user)

        return False


class HasAnnouncementCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False

        if is_general_manager(request.user):
            return True

        if is_parent(request.user):
            return False

        action = getattr(view, "action", None)

        if action == "upload_image":
            return is_unit_manager(request.user) or is_unit_media(request.user)

        if action in (
            "submit_review",
            "approve",
            "reject",
            "archive",
            "restore",
        ):
            return is_unit_manager(request.user)

        if action == "publish":
            return False

        if request.method in SAFE_METHODS:
            return is_unit_manager(request.user) or is_unit_media(request.user)

        if request.method == "POST":
            return is_unit_manager(request.user)

        if request.method in ("PUT", "PATCH", "DELETE"):
            return is_unit_manager(request.user)

        return False

    def has_object_permission(self, request, view, obj) -> bool:
        if isinstance(obj, AnnouncementCategory):
            return HasAnnouncementCategoryCMSPermission().has_permission(request, view)

        if not isinstance(obj, Announcement):
            return False

        if is_general_manager(request.user):
            return True

        action = getattr(view, "action", None)

        if action == "upload_image":
            return user_can_upload_announcement_media(request.user, obj)

        if request.method in SAFE_METHODS:
            return user_can_access_announcement_object(request.user, obj)

        return user_can_write_announcement_object(request.user, obj)