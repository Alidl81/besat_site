from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from apps.announcements.models import Announcement
from apps.departments.models import Department
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.site_settings.models import SiteSettings
from apps.units.models import SchoolUnit

from .models import HomeSlide
from .permissions import HasHomeSlideCMSPermission
from .serializers import (
    CMSHomeSlideSerializer,
    CMSHomeSlideWriteSerializer,
    HomeSlideSerializer,
)


def build_absolute_file_url(request, file_field):
    if not file_field:
        return None

    try:
        url = file_field.url
    except (ValueError, AttributeError):
        return None

    return request.build_absolute_uri(url)

def file_url_or_raw_value(request, value):
    if not value:
        return None

    if hasattr(value, "url"):
        return build_absolute_file_url(request, value)

    return value

def category_payload(category):
    if category is None:
        return None

    return {
        "id": category.id,
        "title": category.title,
        "slug": category.slug,
    }


def unit_payload(unit):
    if unit is None:
        return None

    return {
        "id": unit.id,
        "title": unit.title,
        "slug": unit.slug,
    }


def site_settings_payload(request, settings_obj):
    if settings_obj is None:
        return None

    return {
        "school_name": getattr(settings_obj, "school_name", None),
        "short_name": getattr(settings_obj, "short_name", None),
        "slogan": getattr(settings_obj, "slogan", None),
        "intro_text": getattr(settings_obj, "intro_text", None),

        "logo": build_absolute_file_url(
            request,
            getattr(settings_obj, "logo", None),
        ),
        "favicon": build_absolute_file_url(
            request,
            getattr(settings_obj, "favicon", None),
        ),

        "hero_title": getattr(settings_obj, "hero_title", None),
        "hero_subtitle": getattr(settings_obj, "hero_subtitle", None),
        "hero_image": build_absolute_file_url(
            request,
            getattr(settings_obj, "hero_image", None),
        ),

        "address": getattr(settings_obj, "address", None),
        "phone_primary": getattr(settings_obj, "phone_primary", None),
        "phone_secondary": getattr(settings_obj, "phone_secondary", None),
        "email": getattr(settings_obj, "email", None),
        "working_hours": getattr(settings_obj, "working_hours", None),

        "instagram_url": getattr(settings_obj, "instagram_url", None),
        "telegram_url": getattr(settings_obj, "telegram_url", None),
        "eitaa_url": getattr(settings_obj, "eitaa_url", None),

        "map_url": getattr(settings_obj, "map_url", None),

        "founded_year": getattr(settings_obj, "founded_year", None),
        "students_count": getattr(settings_obj, "students_count", None),
        "staff_count": getattr(settings_obj, "staff_count", None),
        "achievements_count": getattr(settings_obj, "achievements_count", None),
        "units_count": getattr(settings_obj, "units_count", None),
    }


def school_unit_payload(request, unit):
    return {
        "id": unit.id,
        "title": unit.title,
        "slug": unit.slug,
        "subtitle": unit.subtitle,
        "description": unit.description,
        "cover_image": build_absolute_file_url(request, unit.cover_image),
        "icon": None,
        "age_range": unit.age_range,
        "grade_range": unit.grade_range,
    }


def department_payload(request, department):
    return {
        "id": department.id,
        "title": department.title,
        "slug": department.slug,
        "short_description": department.short_description,
        "description": department.description,
        "icon": file_url_or_raw_value(
            request,
            getattr(department, "icon", None),
        ),
        "cover_image": build_absolute_file_url(
            request,
            getattr(department, "cover_image", None),
        ),
    }


def news_payload(request, news):
    image_url = build_absolute_file_url(request, news.cover_image)

    return {
        "id": news.id,
        "type": "news",
        "title": news.title,
        "slug": news.slug,
        "summary": news.summary,
        "cover_image": image_url,
        "image": image_url,
        "published_at": news.published_at,
        "category": category_payload(news.category),
        "scope": news.scope,
        "unit_id": news.unit_id,
        "unit": unit_payload(news.unit),
        "is_featured": news.is_featured,
    }


def announcement_payload(request, announcement):
    image_url = build_absolute_file_url(request, announcement.cover_image)

    return {
        "id": announcement.id,
        "type": "announcement",
        "title": announcement.title,
        "slug": announcement.slug,
        "summary": announcement.summary,
        "cover_image": image_url,
        "image": image_url,
        "published_at": announcement.published_at,
        "category": category_payload(announcement.category),
        "scope": announcement.scope,
        "unit_id": announcement.unit_id,
        "unit": unit_payload(announcement.unit),
        "is_featured": announcement.is_featured,
    }


def gallery_payload(request, item):
    image_url = build_absolute_file_url(request, item.image)

    return {
        "id": item.id,
        "type": "gallery",
        "title": item.title,
        "slug": item.slug,
        "summary": item.summary,
        "image": image_url,
        "cover_image": image_url,
        "published_at": item.published_at,
        "scope": item.scope,
        "unit_id": item.unit_id,
        "unit": unit_payload(item.unit),
        "is_featured": item.is_featured,
    }


class HomePageAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Home"],
        summary="Get public home page aggregate payload",
    )
    def get(self, request):
        today = timezone.localdate()

        settings_obj = SiteSettings.objects.filter(is_active=True).first()

        slides = HomeSlide.objects.filter(
            is_active=True,
            image__isnull=False,
        ).order_by("order", "-id")

        units = SchoolUnit.objects.filter(
            is_active=True,
        ).order_by("order", "id")[:10]

        departments = Department.objects.filter(
            is_active=True,
        ).order_by("order", "id")[:10]

        latest_news = (
            News.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=News.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
                scope=News.Scope.SCHOOL,
            )
            .order_by("-published_at", "-id")[:6]
        )

        latest_announcements = (
            Announcement.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=Announcement.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
                scope=Announcement.Scope.SCHOOL,
            )
            .order_by("-published_at", "-id")[:6]
        )

        featured_gallery = (
            GalleryItem.objects.select_related("unit")
            .filter(
                is_active=True,
                status=GalleryItem.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
                scope=GalleryItem.Scope.SCHOOL,
                is_featured=True,
            )
            .order_by("order", "-published_at", "-id")[:8]
        )

        return Response(
            {
                "settings": site_settings_payload(request, settings_obj),
                "slides": HomeSlideSerializer(
                    slides,
                    many=True,
                    context={"request": request},
                ).data,
                "units": [
                    school_unit_payload(request, unit)
                    for unit in units
                ],
                "departments": [
                    department_payload(request, department)
                    for department in departments
                ],
                "latest_news": [
                    news_payload(request, news)
                    for news in latest_news
                ],
                "latest_announcements": [
                    announcement_payload(request, announcement)
                    for announcement in latest_announcements
                ],
                "featured_gallery": [
                    gallery_payload(request, item)
                    for item in featured_gallery
                ],
                "featured_achievements": [],
            }
        )


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS list home slides",
        parameters=[
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    create=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS create home slide",
    ),
    retrieve=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS retrieve home slide",
    ),
    update=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS update home slide",
    ),
    partial_update=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS partially update home slide",
    ),
    destroy=extend_schema(
        tags=["CMS - Home Slides"],
        summary="CMS delete home slide",
    ),
)
class CMSHomeSlideViewSet(ModelViewSet):
    queryset = HomeSlide.objects.none()
    permission_classes = [HasHomeSlideCMSPermission]
    parser_classes = (
        JSONParser,
        FormParser,
        MultiPartParser,
    )

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "subtitle",
        "alt_text",
        "href",
    )
    ordering_fields = (
        "order",
        "created_at",
        "updated_at",
        "title",
    )
    ordering = (
        "order",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return HomeSlide.objects.none()

        return (
            HomeSlide.objects.select_related(
                "created_by",
                "updated_by",
            )
            .order_by("order", "-id")
        )

    def get_serializer_class(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
        ):
            return CMSHomeSlideWriteSerializer

        return CMSHomeSlideSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
        )