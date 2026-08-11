from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from ..models import ShippingMethod, ShopSettings
from ..permissions import HasShopOrderCMSPermission
from ..serializers.cms_settings import CMSShippingMethodSerializer, CMSShopSettingsSerializer


@extend_schema_view(
    list=extend_schema(tags=["CMS - Shop"], summary="List shipping methods (admin)"),
    retrieve=extend_schema(tags=["CMS - Shop"], summary="Retrieve a shipping method (admin)"),
    create=extend_schema(tags=["CMS - Shop"], summary="Create a shipping method"),
    update=extend_schema(tags=["CMS - Shop"], summary="Replace a shipping method"),
    partial_update=extend_schema(tags=["CMS - Shop"], summary="Update a shipping method"),
    destroy=extend_schema(tags=["CMS - Shop"], summary="Delete a shipping method"),
)
class CMSShippingMethodViewSet(ModelViewSet):
    queryset = ShippingMethod.objects.all().order_by("order", "id")
    serializer_class = CMSShippingMethodSerializer
    permission_classes = [HasShopOrderCMSPermission]


class CMSShopSettingsAPIView(APIView):
    permission_classes = [HasShopOrderCMSPermission]

    @extend_schema(tags=["CMS - Shop"], summary="Get shop settings (admin)", responses=CMSShopSettingsSerializer)
    def get(self, request):
        settings_obj = ShopSettings.load()
        return Response(CMSShopSettingsSerializer(settings_obj).data)

    @extend_schema(
        tags=["CMS - Shop"], summary="Update shop settings (admin)",
        request=CMSShopSettingsSerializer, responses=CMSShopSettingsSerializer,
    )
    def patch(self, request):
        settings_obj = ShopSettings.load()
        serializer = CMSShopSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
