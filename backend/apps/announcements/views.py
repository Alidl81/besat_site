from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import filters
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import Announcement, AnnouncementCategory
from .permissions import HasAnnouncementCategoryCMSPermission
from .serializers import (
    AnnouncementCategoryListSerializer,
    AnnouncementDetailSerializer,
    AnnouncementListSerializer,
    CMSAnnouncementCategorySerializer,
)


class AnnouncementCategoryListAPIView(ListAPIView):
    queryset = AnnouncementCategory.objects.none()
    serializer_class = AnnouncementCategoryListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    @extend_schema(
        tags=["Announcements"],
        summary="List active announcement categories",
        responses=AnnouncementCategoryListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AnnouncementCategory.objects.none()

        return AnnouncementCategory.objects.filter(is_active=True).order_by("order", "id")


@extend_schema_view(
    list=extend_schema(
        tags=["Announcements"],
        summary="List published announcements",
        parameters=[
            OpenApiParameter(
                name="page",
                description="Page number for paginated results.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="scope",
                description="Filter by scope. Accepted values: school, unit.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="unit_id",
                description="Required when scope=unit.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Public API only returns published content. Accepted value: published.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="category",
                description="Filter announcements by category slug.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="search",
                description="Search in title, summary, plain content text, category title, and unit title.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="featured",
                description="Filter featured announcements. Accepted values: true, false.",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="ordering",
                description="Allowed: published_at, -published_at, title, -title.",
                required=False,
                type=str,
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=["Announcements"],
        summary="Retrieve published announcement by slug",
        responses=AnnouncementDetailSerializer,
    ),
)
class AnnouncementViewSet(ReadOnlyModelViewSet):
    queryset = Announcement.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "summary",
        "content_text",
        "category__title",
        "unit__title",
    )
    ordering_fields = (
        "published_at",
        "title",
    )
    ordering = (
        "-published_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Announcement.objects.none()

        today = timezone.localdate()

        queryset = (
            Announcement.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=Announcement.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .filter(
                Q(category__isnull=True) | Q(category__is_active=True)
            )
            .filter(
                Q(unit__isnull=True) | Q(unit__is_active=True)
            )
            .order_by("-published_at", "-id")
        )

        status_param = self.request.query_params.get("status")

        if status_param and status_param != Announcement.Status.PUBLISHED:
            return Announcement.objects.none()

        scope = self.request.query_params.get("scope")
        unit_id = self.request.query_params.get("unit_id")

        if scope == Announcement.Scope.SCHOOL:
            queryset = queryset.filter(
                scope=Announcement.Scope.SCHOOL,
                unit__isnull=True,
            )

        elif scope == Announcement.Scope.UNIT:
            if not unit_id:
                return Announcement.objects.none()

            queryset = queryset.filter(
                scope=Announcement.Scope.UNIT,
                unit_id=unit_id,
            )

        elif unit_id:
            queryset = queryset.filter(
                scope=Announcement.Scope.UNIT,
                unit_id=unit_id,
            )

        category_slug = self.request.query_params.get("category")

        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        featured = self.request.query_params.get("featured")

        if featured is not None:
            featured_value = featured.strip().lower()

            if featured_value in ("true", "1", "yes"):
                queryset = queryset.filter(is_featured=True)

            elif featured_value in ("false", "0", "no"):
                queryset = queryset.filter(is_featured=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AnnouncementDetailSerializer

        return AnnouncementListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS list announcement categories",
    ),
    create=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS create announcement category",
    ),
    retrieve=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS retrieve announcement category",
    ),
    update=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS update announcement category",
    ),
    partial_update=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS partially update announcement category",
    ),
    destroy=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS delete announcement category",
    ),
)
class CMSAnnouncementCategoryViewSet(ModelViewSet):
    queryset = AnnouncementCategory.objects.none()
    serializer_class = CMSAnnouncementCategorySerializer
    permission_classes = [HasAnnouncementCategoryCMSPermission]
    lookup_value_regex = r"\d+"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
    )
    ordering_fields = (
        "order",
        "title",
    )
    ordering = (
        "order",
        "id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AnnouncementCategory.objects.none()

        return AnnouncementCategory.objects.all().order_by("order", "id")
