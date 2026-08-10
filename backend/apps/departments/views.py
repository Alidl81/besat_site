from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.core.permissions import IsGeneralManager
from apps.news.permissions import is_general_manager

from .models import Department
from .serializers import CMSDepartmentSerializer, DepartmentDetailSerializer, DepartmentListSerializer


def _normalize_department_title(value: str) -> str:
    """Collapse whitespace/ZWNJ variance and unify Arabic/Persian letter
    forms (ي/ی, ك/ک) so title matching is exact but tolerant of the
    encoding variance common in Persian data entry."""
    if not value:
        return ""

    normalized = value.replace("‌", " ").replace("ي", "ی").replace("ك", "ک")
    return " ".join(normalized.strip().split())


# Retired department entries: kept manageable in the CMS (apps/departments
# admin panel) so a general manager can still see/edit/delete them, but
# excluded from the public departments wheel and virtual tour. Matched by
# normalized title rather than slug/id because the offending rows are
# pre-existing production data whose exact slugs vary by environment.
_RETIRED_DEPARTMENT_TITLES = frozenset(
    _normalize_department_title(title)
    for title in (
        "معاونت آموزشی",
        "معاونت فرهنگی",
        "باشگاه المپیاد",
    )
)


@extend_schema_view(
    list=extend_schema(
        tags=["Departments"],
        summary="List active departments",
        parameters=[
            OpenApiParameter(
                name="search",
                description="Search in title, slug, short description, and description.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="ordering",
                description="Allowed: order, -order, title, -title, id, -id.",
                required=False,
                type=str,
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=["Departments"],
        summary="Retrieve active department by slug",
    ),
)
class DepartmentViewSet(ReadOnlyModelViewSet):
    queryset = Department.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"
    pagination_class = None

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
        "short_description",
        "description",
    )
    ordering_fields = (
        "order",
        "title",
        "id",
    )
    ordering = (
        "order",
        "id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Department.objects.none()

        queryset = Department.objects.filter(is_active=True)
        retired_ids = [
            department.id
            for department in queryset
            if _normalize_department_title(department.title) in _RETIRED_DEPARTMENT_TITLES
        ]
        if retired_ids:
            queryset = queryset.exclude(id__in=retired_ids)

        return queryset.order_by("order", "id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DepartmentDetailSerializer

        return DepartmentListSerializer


class CMSDepartmentViewSet(ModelViewSet):
    serializer_class = CMSDepartmentSerializer
    lookup_value_regex = r"\d+"
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "slug", "short_description", "description")
    ordering_fields = ("order", "title", "created_at", "updated_at", "is_active")
    ordering = ("order", "id")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated(), IsGeneralManager()]

    def get_queryset(self):
        queryset = Department.objects.all()
        if not is_general_manager(self.request.user):
            queryset = queryset.filter(is_active=True)
        return queryset.order_by("order", "id")
