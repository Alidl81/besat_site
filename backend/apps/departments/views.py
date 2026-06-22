from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import Department
from .serializers import DepartmentDetailSerializer, DepartmentListSerializer


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

        return Department.objects.filter(is_active=True).order_by("order", "id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DepartmentDetailSerializer

        return DepartmentListSerializer