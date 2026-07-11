from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.news.permissions import is_general_manager

class IsAdminOrReadOnly(BasePermission):
    """
        Allows public read access, but write access only for admin users.
    """
    
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        
        return bool(request.user and request.user.is_staff)


class IsGeneralManager(BasePermission):
    """Allow access only to the authenticated general-manager role."""

    message = "فقط مدیر کل اجازه انجام این عملیات را دارد."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and is_general_manager(request.user))
