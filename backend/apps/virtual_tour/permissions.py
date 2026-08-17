from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import UserUnitMembership
from apps.gallery.permissions import (
    get_accessible_unit_ids,
    is_general_manager,
    is_parent,
    is_unit_manager,
    is_unit_media,
    user_has_active_profile,
)

from .models import TourScene

__all__ = [
    "get_accessible_unit_ids",
    "is_general_manager",
    "is_parent",
    "is_unit_manager",
    "is_unit_media",
    "user_has_active_profile",
    "user_can_access_tour_scene",
    "user_can_write_tour_scene",
    "user_can_submit_tour_scene",
    "user_can_review_tour_scene",
    "HasVirtualTourCMSPermission",
]


def user_can_access_tour_scene(user, scene: TourScene) -> bool:
    if is_general_manager(user):
        return True

    if is_parent(user):
        return False

    # Department-scoped scenes aren't tied to any unit -- only
    # general_manager manages them, mirroring how departments span the
    # whole school rather than a single unit.
    if scene.unit_id is None:
        return False

    return scene.unit_id in get_accessible_unit_ids(user)


def user_can_write_tour_scene(user, scene: TourScene) -> bool:
    if is_general_manager(user):
        return True

    if scene.unit_id is None:
        return False

    if scene.status in (TourScene.Status.APPROVED, TourScene.Status.PUBLISHED):
        return False

    if is_unit_manager(user):
        allowed_roles = (UserUnitMembership.UnitRole.UNIT_MANAGER,)
    elif is_unit_media(user):
        allowed_roles = (UserUnitMembership.UnitRole.UNIT_MEDIA,)
    else:
        return False

    return scene.unit_id in get_accessible_unit_ids(user, allowed_roles=allowed_roles)


def user_can_submit_tour_scene(user, scene: TourScene) -> bool:
    if is_general_manager(user):
        return True

    if scene.unit_id is None:
        return False

    if is_unit_manager(user):
        allowed_roles = (UserUnitMembership.UnitRole.UNIT_MANAGER,)
    elif is_unit_media(user):
        allowed_roles = (UserUnitMembership.UnitRole.UNIT_MEDIA,)
    else:
        return False

    return scene.unit_id in get_accessible_unit_ids(user, allowed_roles=allowed_roles)


def user_can_review_tour_scene(user, scene: TourScene) -> bool:
    if is_general_manager(user):
        return True

    if not is_unit_manager(user):
        return False

    if scene.unit_id is None:
        return False

    return scene.unit_id in get_accessible_unit_ids(
        user, allowed_roles=(UserUnitMembership.UnitRole.UNIT_MANAGER,)
    )


class HasVirtualTourCMSPermission(BasePermission):
    """Mirrors apps/gallery/permissions.py::HasGalleryCMSPermission's exact
    capability matrix: unit_media create/edit/submit, unit_manager
    additionally approve/reject/archive/restore, publish is
    general_manager-only. Department-scoped scenes are general_manager-only
    for every write action (see user_can_write_tour_scene)."""

    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False

        if is_general_manager(request.user):
            return True

        if is_parent(request.user):
            return False

        action = getattr(view, "action", None)

        if request.method in SAFE_METHODS:
            return is_unit_manager(request.user) or is_unit_media(request.user)

        if action == "submit_review":
            return is_unit_manager(request.user) or is_unit_media(request.user)

        if action in ("approve", "reject", "archive", "restore"):
            return is_unit_manager(request.user)

        if action == "publish":
            return False

        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return is_unit_manager(request.user) or is_unit_media(request.user)

        return False

    def has_object_permission(self, request, view, obj) -> bool:
        if not isinstance(obj, TourScene):
            return False

        if is_general_manager(request.user):
            return True

        action = getattr(view, "action", None)

        if request.method in SAFE_METHODS:
            return user_can_access_tour_scene(request.user, obj)

        if action == "submit_review":
            return user_can_submit_tour_scene(request.user, obj)

        if action in ("approve", "reject", "archive", "restore"):
            return user_can_review_tour_scene(request.user, obj)

        if action == "publish":
            return False

        return user_can_write_tour_scene(request.user, obj)
