from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile

from ..models import ShippingMethod
from ..serializers import CheckoutPreviewRequestSerializer, CheckoutPreviewResponseSerializer
from ..services import cart_service
from ..services.checkout_service import build_checkout_preview


class CheckoutPreviewAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(
        tags=["Shop"],
        summary="Compute server-authoritative checkout totals without creating an order",
        request=CheckoutPreviewRequestSerializer,
        responses=CheckoutPreviewResponseSerializer,
    )
    def post(self, request):
        serializer = CheckoutPreviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart, _ = cart_service.get_or_create_active_cart(user=request.user)

        shipping_method = None
        shipping_method_id = serializer.validated_data.get("shipping_method_id")
        if shipping_method_id:
            shipping_method = ShippingMethod.objects.filter(pk=shipping_method_id, is_active=True).first()
            if shipping_method is None:
                raise DRFValidationError({"shipping_method_id": "روش ارسال معتبر نیست."})

        preview = build_checkout_preview(cart, shipping_method=shipping_method)
        return Response(preview)
