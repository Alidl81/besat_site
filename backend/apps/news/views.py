from django.core.exceptions import ValidationError as DjangoValidationError
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
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.models import UserProfile, UserUnitMembership

from .models import News, NewsCategory
from .permissions import (
    HasNewsCategoryCMSPermission,
    HasNewsCMSPermission,
    get_accessible_unit_ids,
    is_general_manager,
    is_unit_manager,
    user_can_upload_news_media,
    user_can_write_news_object,
)
from .serializers import (
    CMSNewsCategorySerializer,
    CMSNewsDetailSerializer,
    CMSNewsListSerializer,
    CMSNewsWriteSerializer,
    NewsCategoryListSerializer,
    NewsDetailSerializer,
    NewsListSerializer,
    NewsMediaUploadSerializer,
    NewsWorkflowActionSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


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
                name="scope",
                description="Filter by scope. Accepted values: school, unit.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="unit_id",
                description="Required when scope=unit.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Public API only returns published content. Accepted value: published.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="category",
                description="Filter news by category slug.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="search",
                description="Search in title, summary, plain content text, category title, and unit title.",
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
        "unit__title",
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
            News.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=News.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .filter(
                Q(category__isnull=True) | Q(category__is_active=True)
            )
            .filter(
                Q(unit__isnull=True) | Q(unit__is_active=True)
            )
            .order_by("-published_at", "-id")
        )

        status_param = self.request.query_params.get("status")

        if status_param and status_param != News.Status.PUBLISHED:
            return News.objects.none()

        scope = self.request.query_params.get("scope")
        unit_id = self.request.query_params.get("unit_id")

        if scope == News.Scope.SCHOOL:
            queryset = queryset.filter(scope=News.Scope.SCHOOL, unit__isnull=True)

        elif scope == News.Scope.UNIT:
            if not unit_id:
                return News.objects.none()

            queryset = queryset.filter(scope=News.Scope.UNIT, unit_id=unit_id)

        elif unit_id:
            queryset = queryset.filter(scope=News.Scope.UNIT, unit_id=unit_id)

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
    permission_classes = [HasNewsCategoryCMSPermission]
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
        "unit__title",
    )
    ordering_fields = (
        "published_at",
        "created_at",
        "updated_at",
        "title",
        "status",
        "scope",
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
                "unit",
                "created_by",
                "updated_by",
                "published_by",
            )
            .prefetch_related("media_items")
            .order_by("-updated_at", "-id")
        )

        if not is_general_manager(self.request.user):
            accessible_unit_ids = get_accessible_unit_ids(self.request.user)

            if not accessible_unit_ids:
                return News.objects.none()

            queryset = queryset.filter(
                scope=News.Scope.UNIT,
                unit_id__in=accessible_unit_ids,
            )

        status_param = self.request.query_params.get("status")

        if status_param:
            queryset = queryset.filter(status=status_param)

        scope = self.request.query_params.get("scope")

        if scope:
            queryset = queryset.filter(scope=scope)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

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

        if self.action in (
            "submit_review",
            "approve",
            "publish",
            "reject",
            "archive",
            "restore",
        ):
            return NewsWorkflowActionSerializer

        return CMSNewsDetailSerializer

    def _ensure_user_can_write_payload(self, serializer):
        if is_general_manager(self.request.user):
            return

        if not is_unit_manager(self.request.user):
            raise PermissionDenied("شما اجازه مدیریت خبر را ندارید.")

        instance = serializer.instance

        scope = serializer.validated_data.get(
            "scope",
            instance.scope if instance else News.Scope.SCHOOL,
        )
        unit = serializer.validated_data.get(
            "unit",
            instance.unit if instance else None,
        )
        status_value = serializer.validated_data.get(
            "status",
            instance.status if instance else News.Status.DRAFT,
        )

        if scope != News.Scope.UNIT:
            raise PermissionDenied("مدیر واحد فقط می‌تواند محتوای وابسته به واحد ایجاد یا ویرایش کند.")

        if unit is None:
            raise PermissionDenied("برای محتوای واحدی، انتخاب واحد الزامی است.")

        accessible_unit_ids = get_accessible_unit_ids(
            self.request.user,
            allowed_roles=(
                UserUnitMembership.UnitRole.UNIT_MANAGER,
            ),
        )

        if unit.id not in accessible_unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

        if status_value in (
            News.Status.APPROVED,
            News.Status.PUBLISHED,
        ):
            raise PermissionDenied("مدیر واحد اجازه تأیید نهایی یا انتشار مستقیم خبر را ندارد.")

    def perform_create(self, serializer):
        self._ensure_user_can_write_payload(serializer)

        status_value = serializer.validated_data.get("status", News.Status.DRAFT)
        published_by = None

        if status_value == News.Status.PUBLISHED:
            published_by = self.request.user

        try:
            serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user,
                published_by=published_by,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_update(self, serializer):
        self._ensure_user_can_write_payload(serializer)

        status_value = serializer.validated_data.get(
            "status",
            serializer.instance.status,
        )

        extra_fields = {
            "updated_by": self.request.user,
        }

        if status_value == News.Status.PUBLISHED and serializer.instance.published_by_id is None:
            extra_fields["published_by"] = self.request.user

        try:
            serializer.save(**extra_fields)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _serialize_news_detail(self, news):
        serializer = CMSNewsDetailSerializer(
            news,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)

    def _save_news_or_raise(self, news):
        try:
            news.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    @extend_schema(
        tags=["CMS - News"],
        summary="Submit news for review",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="submit-review",
    )
    def submit_review(self, request, pk=None):
        news = self.get_object()

        if not user_can_write_news_object(request.user, news):
            raise PermissionDenied("شما اجازه ارسال این خبر برای بررسی را ندارید.")

        if news.status not in (
            News.Status.DRAFT,
            News.Status.REJECTED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط خبر پیش‌نویس یا ردشده قابل ارسال برای بررسی است.",
                }
            )

        news.status = News.Status.WAITING_REVIEW
        news.updated_by = request.user
        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

    @extend_schema(
        tags=["CMS - News"],
        summary="Approve news",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(self, request, pk=None):
        news = self.get_object()

        if not user_can_write_news_object(request.user, news):
            raise PermissionDenied("شما اجازه تأیید این خبر را ندارید.")

        if news.status != News.Status.WAITING_REVIEW:
            raise DRFValidationError(
                {
                    "status": "فقط خبر در انتظار بررسی قابل تأیید است.",
                }
            )

        news.status = News.Status.APPROVED
        news.updated_by = request.user
        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

    @extend_schema(
        tags=["CMS - News"],
        summary="Publish news",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="publish",
    )
    def publish(self, request, pk=None):
        news = self.get_object()

        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار خبر را دارد.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        published_at = serializer.validated_data.get("published_at")

        news.status = News.Status.PUBLISHED
        news.published_at = published_at or timezone.localdate()
        news.published_by = request.user
        news.updated_by = request.user

        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

    @extend_schema(
        tags=["CMS - News"],
        summary="Reject news",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, pk=None):
        news = self.get_object()

        if not user_can_write_news_object(request.user, news):
            raise PermissionDenied("شما اجازه رد کردن این خبر را ندارید.")

        if news.status not in (
            News.Status.WAITING_REVIEW,
            News.Status.APPROVED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط خبر در انتظار بررسی یا تأییدشده قابل رد شدن است.",
                }
            )

        news.status = News.Status.REJECTED
        news.updated_by = request.user
        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

    @extend_schema(
        tags=["CMS - News"],
        summary="Archive news",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="archive",
    )
    def archive(self, request, pk=None):
        news = self.get_object()

        if not user_can_write_news_object(request.user, news):
            raise PermissionDenied("شما اجازه آرشیو کردن این خبر را ندارید.")

        news.status = News.Status.ARCHIVED
        news.updated_by = request.user
        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

    @extend_schema(
        tags=["CMS - News"],
        summary="Restore archived news to draft",
        request=NewsWorkflowActionSerializer,
        responses=CMSNewsDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="restore",
    )
    def restore(self, request, pk=None):
        news = self.get_object()

        if not user_can_write_news_object(request.user, news):
            raise PermissionDenied("شما اجازه بازیابی این خبر را ندارید.")

        if news.status != News.Status.ARCHIVED:
            raise DRFValidationError(
                {
                    "status": "فقط خبر آرشیوشده قابل بازیابی است.",
                }
            )

        news.status = News.Status.DRAFT
        news.updated_by = request.user
        self._save_news_or_raise(news)

        return self._serialize_news_detail(news)

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

        if not user_can_upload_news_media(request.user, news):
            raise PermissionDenied("شما اجازه آپلود تصویر برای این خبر را ندارید.")

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