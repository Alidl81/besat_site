from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.models import UserUnitMembership

from .permissions import (
    HasGalleryCMSPermission,
    get_accessible_unit_ids,
    is_general_manager,
    is_unit_manager,
    is_unit_media,
    user_can_review_gallery_item,
    user_can_submit_gallery_item,
    user_can_write_gallery_item,
)
from .serializers import (
    CMSGalleryItemDetailSerializer,
    CMSGalleryItemListSerializer,
    GalleryItemDetailSerializer,
    GalleryItemListSerializer,
    GalleryWorkflowActionSerializer,
)



def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


@extend_schema_view(
    list=extend_schema(
        tags=["Gallery"],
        summary="List published gallery items",
        parameters=[
            OpenApiParameter("page", int, required=False),
            OpenApiParameter("scope", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("status", str, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("ordering", str, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["Gallery"],
        summary="Retrieve published gallery item by slug",
        responses=GalleryItemDetailSerializer,
    ),
)
class GalleryItemViewSet(ReadOnlyModelViewSet):
    queryset = GalleryItem.objects.none()
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
        "alt_text",
        "caption",
        "unit__title",
    )
    ordering_fields = (
        "published_at",
        "event_date",
        "title",
        "order",
    )
    ordering = (
        "order",
        "-published_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return GalleryItem.objects.none()

        today = timezone.localdate()

        queryset = (
            GalleryItem.objects.select_related("unit")
            .filter(
                is_active=True,
                status=GalleryItem.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .order_by("order", "-published_at", "-id")
        )

        status_param = self.request.query_params.get("status")

        if status_param and status_param != GalleryItem.Status.PUBLISHED:
            return GalleryItem.objects.none()

        scope = self.request.query_params.get("scope")
        unit_id = self.request.query_params.get("unit_id")

        if scope == GalleryItem.Scope.SCHOOL:
            queryset = queryset.filter(
                scope=GalleryItem.Scope.SCHOOL,
                unit__isnull=True,
            )

        elif scope == GalleryItem.Scope.UNIT:
            if not unit_id:
                return GalleryItem.objects.none()

            queryset = queryset.filter(
                scope=GalleryItem.Scope.UNIT,
                unit_id=unit_id,
            )

        elif unit_id:
            queryset = queryset.filter(
                scope=GalleryItem.Scope.UNIT,
                unit_id=unit_id,
            )

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
            return GalleryItemDetailSerializer

        return GalleryItemListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS list gallery items",
    ),
    create=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS create gallery item",
    ),
    retrieve=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS retrieve gallery item by id",
    ),
    update=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS update gallery item",
    ),
    partial_update=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS partially update gallery item",
    ),
    destroy=extend_schema(
        tags=["CMS - Gallery"],
        summary="CMS delete gallery item",
    ),
)
class CMSGalleryItemViewSet(ModelViewSet):
    queryset = GalleryItem.objects.none()
    permission_classes = [HasGalleryCMSPermission]
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
        "alt_text",
        "caption",
        "unit__title",
    )
    ordering_fields = (
        "published_at",
        "event_date",
        "created_at",
        "updated_at",
        "title",
        "status",
        "scope",
        "order",
    )
    ordering = (
        "-updated_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return GalleryItem.objects.none()

        queryset = (
            GalleryItem.objects.select_related(
                "unit",
                "created_by",
                "updated_by",
                "published_by",
            )
            .order_by("-updated_at", "-id")
        )

        if not is_general_manager(self.request.user):
            accessible_unit_ids = get_accessible_unit_ids(self.request.user)

            if not accessible_unit_ids:
                return GalleryItem.objects.none()

            queryset = queryset.filter(
                scope=GalleryItem.Scope.UNIT,
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

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSGalleryItemListSerializer

        if self.action in ("create", "update", "partial_update"):
            return CMSGalleryItemWriteSerializer

        if self.action in (
            "submit_review",
            "approve",
            "publish",
            "reject",
            "archive",
            "restore",
        ):
            return GalleryWorkflowActionSerializer

        return CMSGalleryItemDetailSerializer

    def _ensure_user_can_write_payload(self, serializer):
        if is_general_manager(self.request.user):
            return

        if not (is_unit_manager(self.request.user) or is_unit_media(self.request.user)):
            raise PermissionDenied("شما اجازه مدیریت گالری را ندارید.")

        instance = serializer.instance

        scope = serializer.validated_data.get(
            "scope",
            instance.scope if instance else GalleryItem.Scope.SCHOOL,
        )
        unit = serializer.validated_data.get(
            "unit",
            instance.unit if instance else None,
        )
        status_value = serializer.validated_data.get(
            "status",
            instance.status if instance else GalleryItem.Status.DRAFT,
        )

        if scope != GalleryItem.Scope.UNIT:
            raise PermissionDenied("کاربر واحد فقط می‌تواند آیتم گالری وابسته به واحد ایجاد یا ویرایش کند.")

        if unit is None:
            raise PermissionDenied("برای گالری واحدی، انتخاب واحد الزامی است.")

        if is_unit_manager(self.request.user):
            allowed_roles = (
                UserUnitMembership.UnitRole.UNIT_MANAGER,
            )

        else:
            allowed_roles = (
                UserUnitMembership.UnitRole.UNIT_MEDIA,
            )

        accessible_unit_ids = get_accessible_unit_ids(
            self.request.user,
            allowed_roles=allowed_roles,
        )

        if unit.id not in accessible_unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

        if status_value in (
            GalleryItem.Status.APPROVED,
            GalleryItem.Status.PUBLISHED,
            GalleryItem.Status.ARCHIVED,
        ):
            raise PermissionDenied("شما اجازه ثبت مستقیم این وضعیت را ندارید.")

    def perform_create(self, serializer):
        self._ensure_user_can_write_payload(serializer)

        status_value = serializer.validated_data.get("status", GalleryItem.Status.DRAFT)
        published_by = None

        if status_value == GalleryItem.Status.PUBLISHED:
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

        if status_value == GalleryItem.Status.PUBLISHED and serializer.instance.published_by_id is None:
            extra_fields["published_by"] = self.request.user

        try:
            serializer.save(**extra_fields)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _serialize_gallery_item_detail(self, item):
        serializer = CMSGalleryItemDetailSerializer(
            item,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)

    def _save_gallery_item_or_raise(self, item):
        try:
            item.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Submit gallery item for review",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="submit-review",
    )
    def submit_review(self, request, pk=None):
        item = self.get_object()

        if not user_can_submit_gallery_item(request.user, item):
            raise PermissionDenied("شما اجازه ارسال این آیتم برای بررسی را ندارید.")

        if item.status not in (
            GalleryItem.Status.DRAFT,
            GalleryItem.Status.REJECTED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط آیتم پیش‌نویس یا ردشده قابل ارسال برای بررسی است.",
                }
            )

        item.status = GalleryItem.Status.WAITING_REVIEW
        item.updated_by = request.user
        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Approve gallery item",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(self, request, pk=None):
        item = self.get_object()

        if not user_can_review_gallery_item(request.user, item):
            raise PermissionDenied("شما اجازه تأیید این آیتم را ندارید.")

        if item.status != GalleryItem.Status.WAITING_REVIEW:
            raise DRFValidationError(
                {
                    "status": "فقط آیتم در انتظار بررسی قابل تأیید است.",
                }
            )

        item.status = GalleryItem.Status.APPROVED
        item.updated_by = request.user
        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Publish gallery item",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="publish",
    )
    def publish(self, request, pk=None):
        item = self.get_object()

        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار آیتم گالری را دارد.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        published_at = serializer.validated_data.get("published_at")

        item.status = GalleryItem.Status.PUBLISHED
        item.published_at = published_at or timezone.localdate()
        item.published_by = request.user
        item.updated_by = request.user

        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Reject gallery item",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, pk=None):
        item = self.get_object()

        if not user_can_review_gallery_item(request.user, item):
            raise PermissionDenied("شما اجازه رد کردن این آیتم را ندارید.")

        if item.status not in (
            GalleryItem.Status.WAITING_REVIEW,
            GalleryItem.Status.APPROVED,
        ):
            raise DRFValidationError(
                {
                    "status": "فقط آیتم در انتظار بررسی یا تأییدشده قابل رد شدن است.",
                }
            )

        item.status = GalleryItem.Status.REJECTED
        item.updated_by = request.user
        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Archive gallery item",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="archive",
    )
    def archive(self, request, pk=None):
        item = self.get_object()

        if not user_can_review_gallery_item(request.user, item):
            raise PermissionDenied("شما اجازه آرشیو کردن این آیتم را ندارید.")

        item.status = GalleryItem.Status.ARCHIVED
        item.updated_by = request.user
        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)

    @extend_schema(
        tags=["CMS - Gallery"],
        summary="Restore archived gallery item to draft",
        request=GalleryWorkflowActionSerializer,
        responses=CMSGalleryItemDetailSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="restore",
    )
    def restore(self, request, pk=None):
        item = self.get_object()

        if not user_can_review_gallery_item(request.user, item):
            raise PermissionDenied("شما اجازه بازیابی این آیتم را ندارید.")

        if item.status != GalleryItem.Status.ARCHIVED:
            raise DRFValidationError(
                {
                    "status": "فقط آیتم آرشیوشده قابل بازیابی است.",
                }
            )

        item.status = GalleryItem.Status.DRAFT
        item.updated_by = request.user
        self._save_gallery_item_or_raise(item)

        return self._serialize_gallery_item_detail(item)