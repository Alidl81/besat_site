from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SiteSettings
from .serializers import SiteSettingsSerializer

class SiteSettingsAPIView(APIView):
    permission_classes = [AllowAny]
    serializer_calss = SiteSettingsSerializer

    @extend_schema(
        tags=["Site Settings"],
        responses=SiteSettingsSerializer,
    )
    def get(self, request):
        site_settings = SiteSettings.objects.get_active()

        if site_settings is None:
            return Response(SiteSettingsSerializer.empty_payload())
        
        serializer = self.serializer_calss(
            site_settings,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)