from rest_framework.permissions import SAFE_METHODS, BasePermission

class IsAdminOrReadOnly(BasePermission):
    """
        Allows public read access, but write access only for admin users.
    """
    
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        
        return bool(request.user and request.user.is_staff)