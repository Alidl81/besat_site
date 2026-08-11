from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile

from ..serializers import AddCartItemSerializer, CartSerializer, UpdateCartItemSerializer
from ..services import cart_service

GUEST_CART_TOKEN_HEADER = "X-Guest-Cart-Token"


def _raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)
    raise DRFValidationError(error.messages)


def _resolve_cart(request):
    user = request.user if request.user.is_authenticated else None
    guest_token = request.headers.get(GUEST_CART_TOKEN_HEADER)
    return cart_service.get_or_create_active_cart(user=user, guest_token=guest_token)


def _cart_response(request, cart, new_guest_token, *, status_code=status.HTTP_200_OK):
    data = CartSerializer(cart, context={"request": request}).data
    response = Response(data, status=status_code)
    if new_guest_token:
        response[GUEST_CART_TOKEN_HEADER] = new_guest_token
    return response


class CartAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Shop"], summary="Get the current cart (authenticated or guest)", responses=CartSerializer)
    def get(self, request):
        cart, new_guest_token = _resolve_cart(request)
        return _cart_response(request, cart, new_guest_token)


class CartItemListCreateAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Shop"],
        summary="Add an item to the cart",
        request=AddCartItemSerializer,
        responses=CartSerializer,
    )
    def post(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart, new_guest_token = _resolve_cart(request)
        try:
            cart_service.add_item(
                cart,
                product_id=serializer.validated_data["product_id"],
                variant_id=serializer.validated_data.get("variant_id"),
                quantity=serializer.validated_data["quantity"],
            )
        except cart_service.CartError as exc:
            raise DRFValidationError({exc.field or "detail": str(exc)}) from exc
        except DjangoValidationError as exc:
            _raise_drf_validation_error(exc)

        return _cart_response(request, cart, new_guest_token, status_code=status.HTTP_201_CREATED)


class CartItemDetailAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Shop"],
        summary="Update a cart item's quantity",
        request=UpdateCartItemSerializer,
        responses=CartSerializer,
    )
    def patch(self, request, item_id: int):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart, new_guest_token = _resolve_cart(request)
        try:
            cart_service.update_item_quantity(cart, item_id, serializer.validated_data["quantity"])
        except cart_service.CartError as exc:
            raise DRFValidationError({exc.field or "detail": str(exc)}) from exc
        except DjangoValidationError as exc:
            _raise_drf_validation_error(exc)

        return _cart_response(request, cart, new_guest_token)

    @extend_schema(tags=["Shop"], summary="Remove an item from the cart", responses=CartSerializer)
    def delete(self, request, item_id: int):
        cart, new_guest_token = _resolve_cart(request)
        try:
            cart_service.remove_item(cart, item_id)
        except cart_service.CartError as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc

        return _cart_response(request, cart, new_guest_token)


class CartMergeAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = CartSerializer

    @extend_schema(tags=["Shop"], summary="Merge the guest cart into the logged-in user's cart", responses=CartSerializer)
    def post(self, request):
        guest_token = request.headers.get(GUEST_CART_TOKEN_HEADER)
        if not guest_token:
            cart, _ = cart_service.get_or_create_active_cart(user=request.user)
            return _cart_response(request, cart, None)

        cart = cart_service.merge_guest_cart_into_user(request.user, guest_token)
        response = _cart_response(request, cart, None)
        # Signal the caller (the BFF proxy, in the real deployment) that
        # the guest cart is spent and its cookie should be cleared.
        response["X-Guest-Cart-Token-Clear"] = "1"
        return response
