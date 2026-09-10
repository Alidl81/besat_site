from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile
from apps.core.utils import throttle_rate_configured

from ..models import Order
from ..serializers import PaymentCallbackResponseSerializer, PaymentStartResponseSerializer
from ..services import payment_service


class PaymentStartAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = PaymentStartResponseSerializer
    throttle_scope = "checkout"

    def get_throttles(self):
        if throttle_rate_configured(self.throttle_scope):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @extend_schema(
        tags=["Shop"],
        summary="Start (or retry) payment for one of my orders",
        responses=PaymentStartResponseSerializer,
    )
    def post(self, request):
        order_number = request.data.get("order_number")
        order = get_object_or_404(Order, order_number=order_number, user=request.user)

        # The redirect destination is always this fixed, server-computed,
        # same-origin-relative path -- never a client-supplied or absolute
        # URL -- so this can't be turned into an open redirect, and it
        # matches what the payment gateway's own return-path allowlist
        # (sanitizeReturnPath on the frontend) actually accepts.
        return_url = f"/shop/orders/{order.order_number}/"

        try:
            attempt, intent = payment_service.start_payment(order, actor=request.user, return_url=return_url)
        except payment_service.PaymentError as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc

        data = {"attempt_id": attempt.pk, "provider": attempt.provider, "redirect_url": intent.redirect_url}
        return Response(PaymentStartResponseSerializer(data).data)


class PaymentCallbackAPIView(APIView):
    """AllowAny by necessity (the payment provider calls this, not a
    logged-in browser session) -- every trust decision happens inside
    payment_service.handle_payment_callback, never here."""

    permission_classes = [AllowAny]
    serializer_class = PaymentCallbackResponseSerializer
    throttle_scope = "payment_callback"

    def get_throttles(self):
        if throttle_rate_configured(self.throttle_scope):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def _handle(self, provider: str, payload) -> Response:
        # REL-PAYMENT-CALLBACK-INPUT-001: this endpoint is AllowAny and
        # reachable by an anonymous provider (or anyone probing it) --
        # a JSON array/null POST body used to reach `request_data.get(...)`
        # deep inside handle_payment_callback and crash with an
        # AttributeError (neither has that method), and an unrecognized
        # `provider` path segment used to crash with an uncaught ValueError
        # from get_payment_provider(), both surfacing as an unhandled 500
        # (and, with DEBUG on, a full traceback) instead of a bounded 4xx.
        # A malformed/unknown attempt_id was already handled gracefully
        # (returns outcome="attempt_not_found") -- only these two input
        # shapes were missing a guard.
        if not isinstance(payload, dict):
            raise DRFValidationError({"detail": "بدنه درخواست نامعتبر است."})
        try:
            result = payment_service.handle_payment_callback(provider, payload)
        except ValueError as exc:
            raise NotFound({"detail": str(exc)}) from exc
        order = result["order"]
        data = {
            "outcome": result["outcome"],
            "order_number": order.order_number if order else None,
            "order_status": order.status if order else None,
        }
        return Response(PaymentCallbackResponseSerializer(data).data)

    @extend_schema(tags=["Shop"], summary="Payment provider callback (POST)", responses=PaymentCallbackResponseSerializer)
    def post(self, request, provider: str):
        return self._handle(provider, request.data)

    @extend_schema(
        tags=["Shop"],
        summary="Payment provider return (GET, for gateways that redirect the browser back with query params)",
        responses=PaymentCallbackResponseSerializer,
    )
    def get(self, request, provider: str):
        return self._handle(provider, request.query_params.dict())
