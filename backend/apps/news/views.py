from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import filters, serializers, status
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import News, NewsCategory
from .permissions import HasNewsCMSPermission
from .serializers import (
    CMSNewsCategorySerializer,
    CMSNewsDetailSerializer,
    CMSNewsListSerializer,
    CMSNewsWriteSerializer,
    NewsCategoryListSerializer,
    NewsDetailSerializer,
    NewsListSerializer,
    NewsMediaUploadSerializer,
)


class NewsCategoryListAPIView(ListAPIView):
    queryset = NewsCategory.objects.none()
    serializer_class = NewsCategoryListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    @extend_schema(
        tags=["News"],
        summary="List active news categories",
        responses=NewsCategoryListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
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
                description="Search in title, summary, plain content text, and category title.",
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
                description="Allowed: published_at, -published_at, title, -title.",
                required=False,
                type=str,
            ),
        ],
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
        "content_text",
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
                status=News.Status.PUBLISHED,
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


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS list news categories",
    ),
    create=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS create news category",
    ),
    retrieve=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS retrieve news category",
    ),
    update=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS update news category",
    ),
    partial_update=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS partially update news category",
    ),
    destroy=extend_schema(
        tags=["CMS - News Categories"],
        summary="CMS delete news category",
    ),
)
class CMSNewsCategoryViewSet(ModelViewSet):
    queryset = NewsCategory.objects.none()
    serializer_class = CMSNewsCategorySerializer
    permission_classes = [HasNewsCMSPermission]
    permission_model = NewsCategory
    lookup_value_regex = r"\d+"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
    )
    ordering_fields = (
        "order",
        "title",
    )
    ordering = (
        "order",
        "id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return NewsCategory.objects.none()

        return NewsCategory.objects.all().order_by("order", "id")


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - News"],
        summary="CMS list news",
    ),
    create=extend_schema(
        tags=["CMS - News"],
        summary="CMS create news draft or article",
    ),
    retrieve=extend_schema(
        tags=["CMS - News"],
        summary="CMS retrieve news by id",
    ),
    update=extend_schema(
        tags=["CMS - News"],
        summary="CMS update news",
    ),
    partial_update=extend_schema(
        tags=["CMS - News"],
        summary="CMS partially update news",
    ),
    destroy=extend_schema(
        tags=["CMS - News"],
        summary="CMS delete news",
    ),
)
class CMSNewsViewSet(ModelViewSet):
    queryset = News.objects.none()
    permission_classes = [HasNewsCMSPermission]
    permission_model = News
    lookup_value_regex = r"\d+"
    parser_classes = (
        JSONParser,
        FormParser,
        MultiPartParser,
    )

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "title",
        "slug",
        "summary",
        "content_text",
        "category__title",
    )
    ordering_fields = (
        "published_at",
        "created_at",
        "updated_at",
        "title",
        "status",
    )
    ordering = (
        "-updated_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return News.objects.none()

        queryset = (
            News.objects.select_related(
                "category",
                "created_by",
                "updated_by",
            )
            .prefetch_related("media_items")
            .order_by("-updated_at", "-id")
        )

        status_param = self.request.query_params.get("status")

        if status_param:
            queryset = queryset.filter(status=status_param)

        category_id = self.request.query_params.get("category")

        if category_id:
            queryset = queryset.filter(category_id=category_id)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSNewsListSerializer

        if self.action in ("create", "update", "partial_update"):
            return CMSNewsWriteSerializer

        if self.action == "upload_image":
            return NewsMediaUploadSerializer

        return CMSNewsDetailSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
        )

    @extend_schema(
        tags=["CMS - News"],
        summary="Upload image for news editor content",
        request=NewsMediaUploadSerializer,
        responses=inline_serializer(
            name="EditorJSImageUploadResponse",
            fields={
                "success": serializers.IntegerField(),
                "file": serializers.DictField(),
            },
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="upload-image",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_image(self, request, pk=None):
        news = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media = serializer.save(
            news=news,
            uploaded_by=request.user,
        )

        image_url = request.build_absolute_uri(media.image.url)

        return Response(
            {
                "success": 1,
                "file": {
                    "url": image_url,
                    "id": media.id,
                    "alt_text": media.alt_text,
                    "caption": media.caption,
                },
            },
            status=status.HTTP_201_CREATED,
        )