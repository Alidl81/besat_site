from django.contrib.auth import get_user_model

from apps.units.models import SchoolUnit

from .models import UserProfile, UserUnitMembership


User = get_user_model()


def get_or_create_user_profile(user) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def get_role_redirect_path(role: str) -> str:
    mapping = {
        UserProfile.Role.GENERAL_MANAGER: "/dashboard/admin",
        UserProfile.Role.UNIT_MANAGER: "/dashboard/unit-manager",
        UserProfile.Role.UNIT_MEDIA: "/dashboard/media",
        UserProfile.Role.PARENT: "/dashboard/parents",
    }

    return mapping.get(role, "/")


def get_user_units_payload(user) -> list[dict]:
    profile = get_or_create_user_profile(user)

    if user.is_superuser or profile.role == UserProfile.Role.GENERAL_MANAGER:
        units = SchoolUnit.objects.filter(is_active=True).order_by("order", "id")

        return [
            {
                "id": unit.id,
                "title": unit.title,
                "slug": unit.slug,
                "access_role": UserProfile.Role.GENERAL_MANAGER,
                "access_role_display": "مدیر کل",
                "role": UserProfile.Role.GENERAL_MANAGER,
            }
            for unit in units
        ]

    memberships = (
        UserUnitMembership.objects.select_related("unit")
        .filter(
            user=user,
            is_active=True,
            unit__is_active=True,
        )
        .order_by("unit__order", "unit__id", "id")
    )

    return [
        {
            "id": membership.unit.id,
            "title": membership.unit.title,
            "slug": membership.unit.slug,
            "access_role": membership.role,
            "access_role_display": membership.get_role_display(),
            "role": membership.role,
        }
        for membership in memberships
    ]


def get_user_permissions_payload(user) -> dict:
    profile = get_or_create_user_profile(user)
    role = profile.role

    is_general_manager = user.is_superuser or role == UserProfile.Role.GENERAL_MANAGER
    is_unit_manager = role == UserProfile.Role.UNIT_MANAGER
    is_unit_media = role == UserProfile.Role.UNIT_MEDIA
    is_parent = role == UserProfile.Role.PARENT

    payload = {
        "role": role,
        "role_display": profile.get_role_display(),
        "redirect_path": get_role_redirect_path(role),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "permissions": {
            "can_access_general_manager_panel": is_general_manager,
            "can_access_unit_manager_panel": is_general_manager or is_unit_manager,
            "can_access_media_panel": is_general_manager or is_unit_manager or is_unit_media,
            "can_access_parent_panel": is_parent,
            "can_manage_all_units": is_general_manager,
            "can_manage_unit_content": is_general_manager or is_unit_manager,
            "can_manage_media": is_general_manager or is_unit_manager or is_unit_media,
            "can_manage_news": is_general_manager or is_unit_manager,
            "can_manage_announcements": is_general_manager or is_unit_manager,
            "can_manage_gallery": is_general_manager or is_unit_manager or is_unit_media,
            "can_review_content": is_general_manager or is_unit_manager,
            "can_publish_content": is_general_manager,
            "can_view_dashboard": True,
        },
        "django_permissions": sorted(user.get_all_permissions()),
    }

    # Flat aliases retained for the older service types still present in the
    # frontend; the canonical detailed permissions object remains unchanged.
    payload.update(
        {
            "can_see_all_units": is_general_manager,
            "can_manage_own_unit": is_general_manager or is_unit_manager,
            "can_create_own_unit_content": is_general_manager or is_unit_manager or is_unit_media,
            "can_review_own_unit_content": is_general_manager or is_unit_manager,
            "can_review_all_content": is_general_manager,
            "can_publish_school_content": is_general_manager,
            "can_publish_unit_content": is_general_manager,
            "can_see_own_children": is_parent,
        }
    )
    return payload
