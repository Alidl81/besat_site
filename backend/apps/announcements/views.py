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

from apps.accounts.models import UserUnitMembership

from .models import Announcement, AnnouncementCategory
from .permissions import (
    HasAnnouncementCategoryCMSPermission,
    HasAnnouncementCMSPermission,
    get_accessible_unit_ids,
    is_general_manager,
    is_unit_manager,
    user_can_upload_announcement_media,
    user_can_write_announcement_object,
)
from .serializers import (
    AnnouncementCategoryListSerializer,
    AnnouncementDetailSerializer,
    AnnouncementListSerializer,
    AnnouncementMediaUploadSerializer,
    AnnouncementWorkflowActionSerializer,
    CMSAnnouncementCategorySerializer,
    CMSAnnouncementDetailSerializer,
    CMSAnnouncementListSerializer,
    CMSAnnouncementWriteSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


class AnnouncementCategoryListAPIView(ListAPIView):
    queryset = AnnouncementCategory.objects.none()
    serializer_class = AnnouncementCategoryListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    @extend_schema(
        tags=["Announcements"],
        summary="List active announcement categories",
        responses=AnnouncementCategoryListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AnnouncementCategory.objects.none()

        return AnnouncementCategory.objects.filter(is_active=True).order_by("order", "id")


@extend_schema_view(
    list=extend_schema(
        tags=["Announcements"],
        summary="List published announcements",
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
                description="Filter announcements by category slug.",
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
                description="Filter featured announcements. Accepted values: true, false.",
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
        tags=["Announcements"],
        summary="Retrieve published announcement by slug",
        responses=AnnouncementDetailSerializer,
    ),
)
class AnnouncementViewSet(ReadOnlyModelViewSet):
    queryset = Announcement.objects.none()
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
            return Announcement.objects.none()

        today = timezone.localdate()

        queryset = (
            Announcement.objects.select_related("category", "unit")
            .filter(
                is_active=True,
                status=Announcement.Status.PUBLISHED,
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

        if status_param and status_param != Announcement.Status.PUBLISHED:
            return Announcement.objects.none()

        scope = self.request.query_params.get("scope")
        unit_id = self.request.query_params.get("unit_id")

        if scope == Announcement.Scope.SCHOOL:
            queryset = queryset.filter(
                scope=Announcement.Scope.SCHOOL,
                unit__isnull=True,
            )

        elif scope == Announcement.Scope.UNIT:
            if not unit_id:
                return Announcement.objects.none()

            queryset = queryset.filter(
                scope=Announcement.Scope.UNIT,
                unit_id=unit_id,
            )

        elif unit_id:
            queryset = queryset.filter(
                scope=Announcement.Scope.UNIT,
                unit_id=unit_id,
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
            return AnnouncementDetailSerializer

        return AnnouncementListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS list announcement categories",
    ),
    create=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS create announcement category",
    ),
    retrieve=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS retrieve announcement category",
    ),
    update=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS update announcement category",
    ),
    partial_update=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS partially update announcement category",
    ),
    destroy=extend_schema(
        tags=["CMS - Announcement Categories"],
        summary="CMS delete announcement category",
    ),
)
class CMSAnnouncementCategoryViewSet(ModelViewSet):
    queryset = AnnouncementCategory.objects.none()
    serializer_class = CMSAnnouncementCategorySerializer
    permission_classes = [HasAnnouncementCategoryCMSPermission]
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
            return AnnouncementCategory.objects.none()

        return AnnouncementCategory.objects.all().order_by("order", "id")


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS list announcements",
    ),
    create=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS create announcement draft or article",
    ),
    retrieve=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS retrieve announcement by id",
    ),
    update=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS update announcement",
    ),
    partial_update=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS partially update announcement",
    ),
    destroy=extend_schema(
        tags=["CMS - Announcements"],
        summary="CMS delete announcement",
    ),
)
class CMSAnnouncementViewSet(ModelViewSet):
    queryset = Announcement.objects.none()
    permission_classes = [HasAnnouncementCMSPermission]
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
            return Announcement.objects.none()

        queryset = (
            Announcement.objects.select_related(
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
                return Announcement.objects.none()

            queryset = queryset.filter(
                scope=Announcement.Scope.UNIT,
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
            return CMSAnnouncementListSerializer

        if self.action in ("create", "update", "partial_update"):
            return CMSAnnouncementWriteSerializer

        if self.action == "upload_image":
            return AnnouncementMediaUploadSerializer

        if self.action in (
            "submit_review",
            "approve",
            "publish",
            "reject",
            "archive",
            "restore",
        ):
            return AnnouncementWorkflowActionSerializer

        return CMSAnnouncementDetailSerializer

    def _ensure_user_can_write_payload(self, serializer):
        if is_general_manager(self.request.user):
            return

        if not is_unit_manager(self.request.user):
            raise PermissionDenied("شما اجازه مدیریت اطلاعیه را ندارید.")

        instance = serializer.instance

        scope = serializer.validated_data.get(
            "scope",
            instance.scope if instance else Announcement.Scope.SCHOOL,
        )
        unit = serializer.validated_data.get(
            "unit",
            instance.unit if instance else None,
        )
        status_value = serializer.validated_data.get(
            "status",
            instance.status if instance else Announcement.Status.DRAFT,
        )

        if scope != Announcement.Scope.UNIT:
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
            Announcement.Status.APPROVED,
            Announcement.Status.PUBLISHED,
        ):
            raise PermissionDenied("مدیر واحد اجازه تأیید نهایی یا انتشار مستقیم اطلاعیه را ندارد.")

    def perform_create(self, serializer):
        self._ensure_user_can_write_payload(serializer)

        status_value = serializer.validated_data.get("status", Announcement.Status.DRAFT)
        published_by = None

        if status_value == Announcement.Status.PUBLISHED:
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

        if status_value == Announcement.Status.PUBLISHED and serializer.instance.published_by_id is None:
            extra_fields["published_by"] = self.request.user

        try:
            serializer.save(**extra_fields)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _serialize_announcement_detail(self, announcement):
        serializer = CMSAnnouncementDetailSerializer(
            announcement,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)

    def _save_announcement_or_raise(self, announcement):
        try:
            announcement.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Submit announcement for review",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="submit-review",
    )
    def submit_review(self, request, pk=None):
        announcement = self.get_object()

        if not user_can_write_announcement_object(request.user, announcement):
            raise PermissionDenied("شما اجازه ارسال این اطلاعیه برای بررسی را ندارید.")

        if announcement.status not in (
            Announcement.Status.DRAFT,
            Announcement.Status.REJECTED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط اطلاعیه پیش‌نویس یا ردشده قابل ارسال برای بررسی است.",
                }
            )

        announcement.status = Announcement.Status.WAITING_REVIEW
        announcement.updated_by = request.user
        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Approve announcement",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(self, request, pk=None):
        announcement = self.get_object()

        if not user_can_write_announcement_object(request.user, announcement):
            raise PermissionDenied("شما اجازه تأیید این اطلاعیه را ندارید.")

        if announcement.status != Announcement.Status.WAITING_REVIEW:
            raise DRFValidationError(
                {
                    "status": "فقط اطلاعیه در انتظار بررسی قابل تأیید است.",
                }
            )

        announcement.status = Announcement.Status.APPROVED
        announcement.updated_by = request.user
        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Publish announcement",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="publish",
    )
    def publish(self, request, pk=None):
        announcement = self.get_object()

        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار اطلاعیه را دارد.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        published_at = serializer.validated_data.get("published_at")

        announcement.status = Announcement.Status.PUBLISHED
        announcement.published_at = published_at or timezone.localdate()
        announcement.published_by = request.user
        announcement.updated_by = request.user

        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Reject announcement",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, pk=None):
        announcement = self.get_object()

        if not user_can_write_announcement_object(request.user, announcement):
            raise PermissionDenied("شما اجازه رد کردن این اطلاعیه را ندارید.")

        if announcement.status not in (
            Announcement.Status.WAITING_REVIEW,
            Announcement.Status.APPROVED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط اطلاعیه در انتظار بررسی یا تأییدشده قابل رد شدن است.",
                }
            )

        announcement.status = Announcement.Status.REJECTED
        announcement.updated_by = request.user
        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Archive announcement",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="archive",
    )
    def archive(self, request, pk=None):
        announcement = self.get_object()

        if not user_can_write_announcement_object(request.user, announcement):
            raise PermissionDenied("شما اجازه آرشیو کردن این اطلاعیه را ندارید.")

        announcement.status = Announcement.Status.ARCHIVED
        announcement.updated_by = request.user
        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Restore archived announcement to draft",
        request=AnnouncementWorkflowActionSerializer,
        responses=CMSAnnouncementDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="restore",
    )
    def restore(self, request, pk=None):
        announcement = self.get_object()

        if not user_can_write_announcement_object(request.user, announcement):
            raise PermissionDenied("شما اجازه بازیابی این اطلاعیه را ندارید.")

        if announcement.status != Announcement.Status.ARCHIVED:
            raise DRFValidationError(
                {
                    "status": "فقط اطلاعیه آرشیوشده قابل بازیابی است.",
                }
            )

        announcement.status = Announcement.Status.DRAFT
        announcement.updated_by = request.user
        self._save_announcement_or_raise(announcement)

        return self._serialize_announcement_detail(announcement)

    @extend_schema(
        tags=["CMS - Announcements"],
        summary="Upload image for announcement editor content",
        request=AnnouncementMediaUploadSerializer,
        responses=inline_serializer(
            name="EditorJSAnnouncementImageUploadResponse",
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
        announcement = self.get_object()

        if not user_can_upload_announcement_media(request.user, announcement):
            raise PermissionDenied("شما اجازه آپلود تصویر برای این اطلاعیه را ندارید.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media = serializer.save(
            announcement=announcement,
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