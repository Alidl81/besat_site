from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from ..models import CourseEnrollment, Order, PaymentAttempt
from ..permissions import HasShopOrderCMSPermission, HasShopPaymentCMSPermission
from ..serializers.cms_orders import (
    CMSCourseEnrollmentSerializer,
    CMSOrderActionSerializer,
    CMSOrderDetailSerializer,
    CMSOrderEventSerializer,
    CMSOrderListSerializer,
    CMSPaymentAttemptSerializer,
)
from ..services import fulfillment_service
from ..services.order_service import InvalidOrderTransition


@extend_schema_view(
    list=extend_schema(tags=["CMS - Shop"], summary="List all orders (admin)"),
    retrieve=extend_schema(tags=["CMS - Shop"], summary="Retrieve an order (admin)"),
)
class CMSOrderViewSet(ReadOnlyModelViewSet):
    queryset = Order.objects.select_related("user", "shipping_method").prefetch_related("items").order_by(
        "-created_at", "-id"
    )
    permission_classes = [HasShopOrderCMSPermission]

    def get_serializer_class(self):
        if self.action == "list":
            return CMSOrderListSerializer
        return CMSOrderDetailSerializer

    def _run_action(self, request, service_fn, **kwargs):
        order = self.get_object()
        serializer = CMSOrderActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = service_fn(order, request.user, reason=serializer.validated_data.get("reason") or None, **kwargs)
        except InvalidOrderTransition as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc
        return Response(CMSOrderDetailSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-processing")
    def mark_processing(self, request, pk=None):
        order = self.get_object()
        try:
            updated = fulfillment_service.mark_processing(order, request.user)
        except InvalidOrderTransition as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc
        return Response(CMSOrderDetailSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-shipped")
    def mark_shipped(self, request, pk=None):
        order = self.get_object()
        try:
            updated = fulfillment_service.mark_shipped(order, request.user)
        except InvalidOrderTransition as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc
        return Response(CMSOrderDetailSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-completed")
    def mark_completed(self, request, pk=None):
        order = self.get_object()
        try:
            updated = fulfillment_service.mark_completed(order, request.user)
        except InvalidOrderTransition as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc
        return Response(CMSOrderDetailSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._run_action(request, fulfillment_service.cancel_order)

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        return self._run_action(request, fulfillment_service.refund_order, partial=False)

    @action(detail=True, methods=["post"], url_path="partial-refund")
    def partial_refund(self, request, pk=None):
        return self._run_action(request, fulfillment_service.refund_order, partial=True)

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        order = self.get_object()
        events = order.events.select_related("actor").order_by("-created_at", "-id")
        return Response(CMSOrderEventSerializer(events, many=True).data)


@extend_schema_view(
    list=extend_schema(tags=["CMS - Shop"], summary="List payment attempts (admin)"),
    retrieve=extend_schema(tags=["CMS - Shop"], summary="Retrieve a payment attempt (admin)"),
)
class CMSPaymentAttemptViewSet(ReadOnlyModelViewSet):
    queryset = PaymentAttempt.objects.select_related("order").order_by("-created_at", "-id")
    serializer_class = CMSPaymentAttemptSerializer
    permission_classes = [HasShopPaymentCMSPermission]


class CMSCourseEnrollmentListAPIView(ListAPIView):
    queryset = CourseEnrollment.objects.select_related("user", "product").order_by("-granted_at", "-id")
    serializer_class = CMSCourseEnrollmentSerializer
    permission_classes = [HasShopOrderCMSPermission]

    @extend_schema(tags=["CMS - Shop"], summary="List course enrollments (admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
