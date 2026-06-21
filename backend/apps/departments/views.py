from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import Department
from .serializers import DepartmentDetailSerializer, DepartmentListSerializer



@extend_schema_view(
    list=extend_schema(
        tags=["Departments"],
        summary="List active departments",
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

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Department.objects.none()

        return Department.objects.filter(is_active=True).order_by("order", "id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DepartmentDetailSerializer

        return DepartmentListSerializer