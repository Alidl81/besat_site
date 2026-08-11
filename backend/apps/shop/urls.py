from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ProductViewSet, ShopCategoryListAPIView

app_name = "shop"

public_router = DefaultRouter()
public_router.register("shop/products", ProductViewSet, basename="shop-product")

cms_router = DefaultRouter()

urlpatterns = [
    path("shop/categories/", ShopCategoryListAPIView.as_view(), name="shop-category-list"),
]

urlpatterns += public_router.urls
urlpatterns += cms_router.urls
