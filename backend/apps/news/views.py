from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import News, NewsCategory
from .serializers import (
    NewsCategoryListSerializer,
    NewsDetailSerializer,
    NewsListSerializer,
)


class NewdCategoryListAPIView(ListAPIView):
    queryset = NewsCategory.objects.none()
    serializer_class = NewsCategoryListSerializer
    pagination_class = None

    @extend_schema(
        tags=["News"],
        summary="List active news categories",
        responses=NewsCategoryListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
    
    def get_queryset(self):
        if getattr(self, "swgger_fake_view", False):
            return NewsCategory.objects.none()
        
        return NewsCategory.objects.filter(is_active=True).order_by("order", "id")
    

@extend_schema_view(
    list=extend_schema(
        tags=["News"],
        summary="List published news",
        parameters=[
            OpenApiParameter(
                name="page",
                description="Page number for paginated results.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="category",
                description="Filter news by category slug.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="search",
                description="Search in title, summary, content, and category title.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="featured",
                description="Filter featured news. Accepted values: true, false.",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="ordering",
                description="Ordering field. Allowed: published_at, -published_at, title, -title.",
                required=False,
                type=str,
            ),
        ],
        responses=NewsListSerializer,
    ),
    retrieve=extend_schema(
        tags=["News"],
        summary="Retrieve published news by slug",
        responses=NewsDetailSerializer,
    ),
)
class NewsViewSet(ReadOnlyModelViewSet):
    queryset = News.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"


    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "summary",
        "content",
        "category__title",
    )
    ordering_fields = (
        "published_at",
        "title",
    )
    ordering = (
        "-published_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return News.objects.none()

        today = timezone.localdate()

        queryset = (
            News.objects.select_related("category")
            .filter(
                is_published=True,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .filter(
                Q(category__isnull=True) | Q(category__is_active=True)
            )
            .order_by("-published_at", "-id")
        )

        category_slug = self.request.query_params.get("category")

        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        featured = self.request.query_params.get("featured")

        if featured is not None:
            featured_value = featured.strip().lower()

            if featured_value in ("true", "1", "yes"):
                queryset = queryset.filter(is_featured=True)

            elif featured_value in ("false", "0", "no"):
                queryset = queryset.filter(is_featured=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return NewsDetailSerializer

        return NewsListSerializer