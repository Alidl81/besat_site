from rest_framework.permissions import BasePermission

from .selectors import get_or_create_user_profile


class IsAuthenticatedAndActiveProfile(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not user.is_active:
            return False

        profile = get_or_create_user_profile(user)

        return profile.is_active