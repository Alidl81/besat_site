from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile
from apps.core.pagination import StandardResultsSetPagination
from apps.core.utils import throttle_rate_configured

from ..models import Address, Order, ShippingMethod
from ..serializers import OrderDetailSerializer, OrderListSerializer, PlaceOrderRequestSerializer
from ..services import cart_service, checkout_service


class OrderListCreateAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "checkout"
            if throttle_rate_configured("checkout"):
                return [ScopedRateThrottle()]
            return []
        return super().get_throttles()

    @extend_schema(tags=["Shop"], summary="List my orders", responses=OrderListSerializer(many=True))
    def get(self, request):
        queryset = (
            Order.objects.filter(user=request.user)
            .prefetch_related("items")
            .order_by("-created_at", "-id")
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = OrderListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Shop"],
        summary="Place an order from my active cart (server-authoritative pricing/stock)",
        request=PlaceOrderRequestSerializer,
        responses={201: OrderDetailSerializer},
    )
    def post(self, request):
        serializer = PlaceOrderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cart, _ = cart_service.get_or_create_active_cart(user=request.user)

        shipping_method = None
        shipping_method_id = data.get("shipping_method_id")
        if shipping_method_id:
            shipping_method = ShippingMethod.objects.filter(pk=shipping_method_id, is_active=True).first()
            if shipping_method is None:
                raise DRFValidationError({"shipping_method_id": "روش ارسال معتبر نیست."})

        shipping_address = None
        address_id = data.get("address_id")
        if address_id:
            shipping_address = Address.objects.filter(pk=address_id, user=request.user).first()
            if shipping_address is None:
                raise DRFValidationError({"address_id": "آدرس معتبر نیست."})

        try:
            order = checkout_service.place_order(
                cart,
                request.user,
                shipping_method=shipping_method,
                shipping_address=shipping_address,
                customer_note=data.get("customer_note"),
            )
        except checkout_service.CheckoutError as exc:
            raise DRFValidationError({exc.field or "detail": str(exc)}) from exc

        return Response(OrderDetailSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]

    @extend_schema(tags=["Shop"], summary="Retrieve one of my orders by order number", responses=OrderDetailSerializer)
    def get(self, request, order_number: str):
        # Filtering by user=request.user in the same queryset that resolves
        # the lookup means another user's order 404s rather than 403s --
        # it never confirms whether the order number even exists.
        order = get_object_or_404(
            Order.objects.prefetch_related("items", "payment_attempts"),
            order_number=order_number,
            user=request.user,
        )
        return Response(OrderDetailSerializer(order).data)
