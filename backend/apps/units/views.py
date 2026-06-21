from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.site_settings.models import SiteSettings

from .models import SchoolUnit
from .serializers import SchoolUnitDetialSerializer, SchoolUnitListSerializer



@extend_schema_view(
    list=extend_schema(
        tags=["Units"],
        summary="List active school units",
    ),
    retrieve=extend_schema(
        tags=["Units"],
        summary="Retrieve active school unit by slug",
    )
)
class SchoolUnitViewSet(ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "sluh"
    pagination_class = None

    def get_queryset(self):
        return SchoolUnit.objects.active().order_by("order", "id")
    
    def get_serializer_class(self):
        if self.action == "retrieve":
            return SchoolUnitDetialSerializer
        
        return SchoolUnitListSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()

        site_settings = SiteSettings.objects.get_active()
        context["shared_unit_icon"] = site_settings.logo if site_settings else None