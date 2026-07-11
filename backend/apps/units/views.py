from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet, ModelViewSet

from apps.core.permissions import IsGeneralManager
from apps.site_settings.models import SiteSettings
from apps.news.permissions import is_general_manager

from .models import SchoolUnit
from .serializers import SchoolUnitDetailSerializer, SchoolUnitListSerializer, CMSSchoolUnitSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["Units"],
        summary="List active school units",
        parameters=[
            OpenApiParameter(
                name="search",
                description="Search in title, subtitle, description, age range, and grade range.",
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
        tags=["Units"],
        summary="Retrieve active school unit by slug or id",
    ),
)
class SchoolUnitViewSet(ReadOnlyModelViewSet):
    queryset = SchoolUnit.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"
    lookup_value_regex = r"[^/]+"
    pagination_class = None

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
        "subtitle",
        "description",
        "age_range",
        "grade_range",
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
            return SchoolUnit.objects.none()

        return SchoolUnit.objects.filter(is_active=True).order_by("order", "id")

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)

        if lookup_value and lookup_value.isdigit():
            obj = get_object_or_404(queryset, pk=int(lookup_value))
        else:
            obj = get_object_or_404(queryset, slug=lookup_value)

        self.check_object_permissions(self.request, obj)

        return obj

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SchoolUnitDetailSerializer

        return SchoolUnitListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()

        site_settings = SiteSettings.objects.get_active()
        context["shared_unit_icon"] = site_settings.logo if site_settings else None

        return context
    
class CMSSchoolUnitViewSet(ModelViewSet):
    queryset = SchoolUnit.objects.none()
    serializer_class = CMSSchoolUnitSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = r"\d+"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )

    search_fields = (
        "title",
        "slug",
        "subtitle",
        "description",
        "age_range",
        "grade_range",
    )

    ordering_fields = (
        "order",
        "title",
        "id",
        "created_at",
        "updated_at",
        "is_active",
    )

    ordering = (
        "order",
        "id",
    )

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated(), IsGeneralManager()]

    def get_queryset(self):
        queryset = SchoolUnit.objects.all()
        if not is_general_manager(self.request.user):
            queryset = queryset.filter(is_active=True)
        return queryset.order_by("order", "id")
