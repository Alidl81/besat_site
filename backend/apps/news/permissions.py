from rest_framework.permissions import BasePermission

from .models import News



class HasNewsCMSPermission(BasePermission):
    """
    Permission for the custom news CMS endpoints.

    Required Django permissions:
    - news.view_news
    - news.add_news
    - news.change_news
    - news.delete_news
    """
    def has_permission(self, request, view) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        model = getattr(view, "permission_model", News)
        app_label = model._meta.app_label
        model_name = model._meta.model_name

        if getattr(view, "action", None) == "uoload_image":
            required_permission = f"{app_label}.change_{model_name}"
            return user.has_perm(required_permission)
        
        permission_codename = self._get_permission_codename(request.method)

        if permission_codename is None:
            return False
        
        required_permission = f"{app_label}.{permission_codename}_{model_name}"

        return user.has_perm(required_permission)

    def has_object_permission(self, request, view, obj) -> bool:
        return self.has_object_permission(request, view)
    
    @staticmethod
    def _get_permission_codename(method: str) -> str | None:
        if method == "GET":
            return "view"
        
        if method == "POST":
            return "add"
        
        if method in ("PUT", "PATCH"):
            return "change"
        
        if method == "DELETE":
            return "delete"
        
        return None
    
    