from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from ..models import Product, ShippingMethod, ShopCategory
from ..serializers import (
    ProductDetailSerializer,
    ProductListSerializer,
    ShippingMethodSerializer,
    ShopCategoryListSerializer,
)


class ShippingMethodListAPIView(ListAPIView):
    queryset = ShippingMethod.objects.none()
    serializer_class = ShippingMethodSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    @extend_schema(
        tags=["Shop"],
        summary="List active shipping methods",
        responses=ShippingMethodSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ShippingMethod.objects.none()
        return ShippingMethod.objects.filter(is_active=True).order_by("order", "id")


class ShopCategoryListAPIView(ListAPIView):
    queryset = ShopCategory.objects.none()
    serializer_class = ShopCategoryListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    @extend_schema(
        tags=["Shop"],
        summary="List active shop categories",
        responses=ShopCategoryListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ShopCategory.objects.none()

        return ShopCategory.objects.filter(is_active=True).order_by("order", "id")


@extend_schema_view(
    list=extend_schema(
        tags=["Shop"],
        summary="List published products",
        parameters=[
            OpenApiParameter(name="page", required=False, type=int),
            OpenApiParameter(
                name="type",
                description="Filter by product type. Accepted: physical, online_course, in_person_course.",
                required=False,
                type=str,
            ),
            OpenApiParameter(name="category", description="Filter by category slug.", required=False, type=str),
            OpenApiParameter(name="price_min", description="Minimum price in rial.", required=False, type=int),
            OpenApiParameter(name="price_max", description="Maximum price in rial.", required=False, type=int),
            OpenApiParameter(
                name="availability",
                description="Physical products only. Accepted: in_stock, low_stock, out_of_stock, preorder.",
                required=False,
                type=str,
            ),
            OpenApiParameter(name="featured", description="Accepted: true, false.", required=False, type=bool),
            OpenApiParameter(
                name="search", description="Search in title, short description, description.", required=False, type=str
            ),
            OpenApiParameter(
                name="ordering",
                description="Allowed: price_amount, -price_amount, title, -title, published_at, -published_at.",
                required=False,
                type=str,
            ),
        ],
    ),
    retrieve=extend_schema(tags=["Shop"], summary="Retrieve published product by slug", responses=ProductDetailSerializer),
)
class ProductViewSet(ReadOnlyModelViewSet):
    queryset = Product.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "short_description", "description")
    ordering_fields = ("price_amount", "title", "published_at")
    ordering = ("order", "-published_at", "-id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Product.objects.none()

        today = timezone.localdate()
        params = self.request.query_params

        queryset = (
            Product.objects.select_related(
                "category", "physical_detail", "online_course_detail", "in_person_course_detail"
            )
            .prefetch_related("gallery_images", "variants")
            .filter(
                is_active=True,
                status=Product.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .filter(Q(category__isnull=True) | Q(category__is_active=True))
        )

        product_type = params.get("type")
        if product_type:
            queryset = queryset.filter(product_type=product_type)

        category_slug = params.get("category")
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        price_min = params.get("price_min")
        if price_min:
            queryset = queryset.filter(price_amount__gte=price_min)

        price_max = params.get("price_max")
        if price_max:
            queryset = queryset.filter(price_amount__lte=price_max)

        availability = params.get("availability")
        if availability:
            queryset = queryset.filter(
                product_type=Product.ProductType.PHYSICAL,
                physical_detail__availability=availability,
            )

        featured = params.get("featured")
        if featured is not None:
            queryset = queryset.filter(is_featured=featured.lower() == "true")

        return queryset.distinct()
