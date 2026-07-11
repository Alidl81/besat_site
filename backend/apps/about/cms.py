from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.viewsets import GenericViewSet

from apps.news.permissions import is_general_manager

from .models import AboutPage


class StaticPageCompatibilitySerializer(serializers.Serializer):
    id = serializers.CharField()
    slug = serializers.CharField()
    title = serializers.CharField(allow_blank=True)
    body_html = serializers.CharField(allow_blank=True)
    meta_description = serializers.CharField(allow_null=True)
    is_published = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


def serialize_static_page(page):
    return {
        "id": str(page.id),
        "slug": "about",
        "title": page.title or "",
        "body_html": page.description or "",
        "meta_description": page.meta_description,
        "is_published": page.is_active,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
    }


class CMSStaticPageViewSet(GenericViewSet):
    """Expose the existing AboutPage model using the frontend static-page shape."""

    serializer_class = StaticPageCompatibilitySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def list(self, request):
        queryset = AboutPage.objects.all()
        if not is_general_manager(request.user):
            queryset = queryset.filter(is_active=True)
        return Response([serialize_static_page(page) for page in queryset])

    def retrieve(self, request, pk=None):
        page = self._get_page(pk)
        if not is_general_manager(request.user) and not page.is_active:
            raise NotFound("صفحه یافت نشد.")
        return Response(serialize_static_page(page))

    def create(self, request):
        self._ensure_manager(request.user)
        if request.data.get("slug", "about") != "about":
            raise ValidationError({"slug": "در نسخه فعلی فقط صفحه about پشتیبانی می‌شود."})
        page = AboutPage.objects.create(
            title=request.data.get("title") or None,
            description=request.data.get("body_html") or None,
            meta_description=request.data.get("meta_description") or None,
            is_active=bool(request.data.get("is_published", True)),
        )
        return Response(serialize_static_page(page), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        return self._update(request, pk)

    def partial_update(self, request, pk=None):
        return self._update(request, pk)

    def destroy(self, request, pk=None):
        self._ensure_manager(request.user)
        page = self._get_page(pk)
        page.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _update(self, request, pk):
        self._ensure_manager(request.user)
        page = self._get_page(pk)
        mapping = {
            "title": "title",
            "body_html": "description",
            "meta_description": "meta_description",
            "is_published": "is_active",
        }
        for input_name, model_name in mapping.items():
            if input_name in request.data:
                setattr(page, model_name, request.data[input_name])
        page.save()
        return Response(serialize_static_page(page))

    @staticmethod
    def _get_page(pk):
        try:
            return AboutPage.objects.get(pk=pk)
        except (AboutPage.DoesNotExist, TypeError, ValueError):
            raise NotFound("صفحه یافت نشد.")

    @staticmethod
    def _ensure_manager(user):
        if not is_general_manager(user):
            raise PermissionDenied("فقط مدیر کل اجازه مدیریت صفحات ایستا را دارد.")
