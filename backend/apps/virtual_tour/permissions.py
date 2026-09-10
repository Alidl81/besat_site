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

from .models import TourHotspot, TourScene

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
        # AUTH-VTOUR-HOTSPOT-OBJECT-PERM-001: CMSTourHotspotViewSet shares
        # this permission class with CMSTourSceneViewSet, but its detail
        # actions (retrieve/update/partial_update/destroy) pass a
        # TourHotspot instance here, not a TourScene -- the original
        # `if not isinstance(obj, TourScene): return False` unconditionally
        # rejected every one of those, including for general_manager,
        # since DRF's GenericAPIView.get_object() always calls
        # check_object_permissions() with the actual fetched instance
        # before any view code runs.
        if isinstance(obj, TourHotspot):
            if is_general_manager(request.user):
                return True

            if is_parent(request.user):
                return False

            if request.method in SAFE_METHODS:
                return user_can_access_tour_scene(request.user, obj.scene)

            # Object-level write authorization for a specific hotspot is
            # enforced by CMSTourHotspotViewSet._ensure_can_write_scene()
            # (called from perform_update()/perform_destroy(), which only
            # run after this check passes) -- that already derives
            # correctly from the hotspot's owning scene and matches this
            # view's own create-time authorization exactly, INCLUDING the
            # terminal-workflow-status lock (AUTH-VTOUR-HOTSPOT-WORKFLOW-001:
            # a non-GM cannot write a hotspot once its scene is
            # approved/published/archived, exactly mirroring
            # CMSTourSceneViewSet's own status guard on the scene itself).
            # Re-deriving an equivalent check here via
            # user_can_write_tour_scene() would duplicate that logic in a
            # second place with a real risk of drifting out of sync -- this
            # only needs to admit the same broad role set has_permission()
            # already allows for a mutating method on this view, not
            # duplicate the scene-ownership/status decision a second time.
            return is_unit_manager(request.user) or is_unit_media(request.user)

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
