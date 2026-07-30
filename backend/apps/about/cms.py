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
    history = serializers.CharField(allow_null=True, required=False)
    founders = serializers.ListField(required=False)
    key_people = serializers.ListField(required=False)
    mission = serializers.CharField(allow_null=True, required=False)
    values = serializers.ListField(required=False)
    goals = serializers.ListField(required=False)
    images = serializers.ListField(required=False)
    video_url = serializers.URLField(allow_null=True, required=False)
    video_poster_url = serializers.URLField(allow_null=True, required=False)
    video_title = serializers.CharField(allow_null=True, required=False)
    video_description = serializers.CharField(allow_null=True, required=False)
    video_caption = serializers.CharField(allow_null=True, required=False)
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
        "history": page.history,
        "founders": page.founders,
        "key_people": page.key_people,
        "mission": page.mission,
        "values": page.values,
        "goals": page.goals,
        "images": page.images,
        "video_url": page.video_url,
        "video_poster_url": page.video_poster_url,
        "video_title": page.video_title,
        "video_description": page.video_description,
        "video_caption": page.video_caption,
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
            history=request.data.get("history") or None,
            founders=request.data.get("founders") or [],
            key_people=request.data.get("key_people") or [],
            mission=request.data.get("mission") or None,
            values=request.data.get("values") or [],
            goals=request.data.get("goals") or [],
            images=request.data.get("images") or [],
            video_url=request.data.get("video_url") or None,
            video_poster_url=request.data.get("video_poster_url") or None,
            video_title=request.data.get("video_title") or None,
            video_description=request.data.get("video_description") or None,
            video_caption=request.data.get("video_caption") or None,
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
            "history": "history",
            "founders": "founders",
            "key_people": "key_people",
            "mission": "mission",
            "values": "values",
            "goals": "goals",
            "images": "images",
            "video_url": "video_url",
            "video_poster_url": "video_poster_url",
            "video_title": "video_title",
            "video_description": "video_description",
            "video_caption": "video_caption",
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
