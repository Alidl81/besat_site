from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressDetailAPIView,
    AddressListCreateAPIView,
    CartAPIView,
    CartItemDetailAPIView,
    CartItemListCreateAPIView,
    CartMergeAPIView,
    CheckoutPreviewAPIView,
    MyCourseEnrollmentsAPIView,
    OrderDetailAPIView,
    OrderListCreateAPIView,
    PaymentCallbackAPIView,
    PaymentStartAPIView,
    ProductViewSet,
    ShopCategoryListAPIView,
)

app_name = "shop"

public_router = DefaultRouter()
public_router.register("shop/products", ProductViewSet, basename="shop-product")

cms_router = DefaultRouter()

urlpatterns = [
    path("shop/categories/", ShopCategoryListAPIView.as_view(), name="shop-category-list"),
    path("shop/cart/", CartAPIView.as_view(), name="shop-cart"),
    path("shop/cart/items/", CartItemListCreateAPIView.as_view(), name="shop-cart-items"),
    path("shop/cart/items/<int:item_id>/", CartItemDetailAPIView.as_view(), name="shop-cart-item-detail"),
    path("shop/cart/merge/", CartMergeAPIView.as_view(), name="shop-cart-merge"),
    path("shop/checkout/preview/", CheckoutPreviewAPIView.as_view(), name="shop-checkout-preview"),
    path("shop/orders/", OrderListCreateAPIView.as_view(), name="shop-order-list-create"),
    path("shop/orders/<str:order_number>/", OrderDetailAPIView.as_view(), name="shop-order-detail"),
    path("shop/payments/start/", PaymentStartAPIView.as_view(), name="shop-payment-start"),
    path("shop/payments/callback/<str:provider>/", PaymentCallbackAPIView.as_view(), name="shop-payment-callback"),
    path("shop/addresses/", AddressListCreateAPIView.as_view(), name="shop-address-list-create"),
    path("shop/addresses/<int:pk>/", AddressDetailAPIView.as_view(), name="shop-address-detail"),
    path("shop/courses/my/", MyCourseEnrollmentsAPIView.as_view(), name="shop-my-courses"),
]

urlpatterns += public_router.urls
urlpatterns += cms_router.urls
