from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.news.permissions import is_general_manager, is_unit_media

from ..models import Product, ProductImage, ShopCategory
from ..permissions import (
    MEDIA_MANAGER_WRITABLE_PRODUCT_FIELDS,
    HasShopCategoryCMSPermission,
    HasShopProductCMSPermission,
)
from ..serializers.cms_catalog import (
    CMSProductDetailSerializer,
    CMSProductImageSerializer,
    CMSProductImageUploadSerializer,
    CMSProductListSerializer,
    CMSProductWriteSerializer,
    CMSShopCategorySerializer,
    ProductWorkflowActionSerializer,
    raise_drf_validation_error,
)

WORKFLOW_ACTIONS = ("submit_review", "approve", "publish", "reject", "archive", "restore")


@extend_schema_view(
    list=extend_schema(tags=["CMS - Shop"], summary="List shop categories (CMS)"),
    retrieve=extend_schema(tags=["CMS - Shop"], summary="Retrieve a shop category (CMS)"),
    create=extend_schema(tags=["CMS - Shop"], summary="Create a shop category"),
    update=extend_schema(tags=["CMS - Shop"], summary="Replace a shop category"),
    partial_update=extend_schema(tags=["CMS - Shop"], summary="Update a shop category"),
    destroy=extend_schema(tags=["CMS - Shop"], summary="Delete a shop category"),
)
class CMSShopCategoryViewSet(ModelViewSet):
    queryset = ShopCategory.objects.all().order_by("order", "id")
    serializer_class = CMSShopCategorySerializer
    permission_classes = [HasShopCategoryCMSPermission]
    parser_classes = (JSONParser, FormParser, MultiPartParser)


def _is_media_manager(user) -> bool:
    return is_unit_media(user) and not is_general_manager(user)


@extend_schema_view(
    list=extend_schema(tags=["CMS - Shop"], summary="List products (CMS)"),
    retrieve=extend_schema(tags=["CMS - Shop"], summary="Retrieve a product (CMS)"),
    create=extend_schema(tags=["CMS - Shop"], summary="Create a product"),
    update=extend_schema(tags=["CMS - Shop"], summary="Replace a product"),
    partial_update=extend_schema(tags=["CMS - Shop"], summary="Update a product"),
    destroy=extend_schema(tags=["CMS - Shop"], summary="Delete a product (admin only)"),
)
class CMSProductViewSet(ModelViewSet):
    queryset = Product.objects.select_related(
        "category", "physical_detail", "online_course_detail", "in_person_course_detail",
        "created_by", "updated_by", "published_by",
    ).prefetch_related("gallery_images")
    permission_classes = [HasShopProductCMSPermission]
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Product.objects.none()
        return super().get_queryset().order_by("-created_at", "-id")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CMSProductWriteSerializer
        if self.action in WORKFLOW_ACTIONS:
            return ProductWorkflowActionSerializer
        if self.action == "upload_image":
            return CMSProductImageUploadSerializer
        if self.action == "list":
            return CMSProductListSerializer
        return CMSProductDetailSerializer

    def _ensure_allowed_payload(self, request):
        if not _is_media_manager(request.user):
            return
        if "physical_detail" in request.data or "course_detail" in request.data:
            raise DRFValidationError({"detail": "دسترسی ویرایش قیمت و موجودی را ندارید."})
        disallowed = set(request.data.keys()) - MEDIA_MANAGER_WRITABLE_PRODUCT_FIELDS
        if disallowed:
            raise DRFValidationError(
                {"detail": f"دسترسی ویرایش این فیلدها را ندارید: {', '.join(sorted(disallowed))}"}
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # CMSProductWriteSerializer is input-only -- respond with the full
        # read representation of what was actually saved, not the write
        # serializer's own (much narrower) .data.
        product = serializer.instance
        return Response(
            CMSProductDetailSerializer(product, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        product = serializer.instance
        return Response(CMSProductDetailSerializer(product, context=self.get_serializer_context()).data)

    def perform_create(self, serializer):
        self._ensure_allowed_payload(self.request)
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        self._ensure_allowed_payload(self.request)
        instance = serializer.instance
        if _is_media_manager(self.request.user) and instance.status not in (
            Product.Status.DRAFT, Product.Status.WAITING_REVIEW, Product.Status.REJECTED,
        ):
            raise PermissionDenied("فقط محصولات پیش‌نویس یا در انتظار بررسی قابل ویرایش توسط همکار رسانه هستند.")
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        if not is_general_manager(self.request.user):
            raise PermissionDenied("فقط مدیر کل اجازه حذف محصول را دارد.")
        instance.delete()

    def _transition(self, request, pk, *, from_statuses, to_status, extra=None):
        product = self.get_object()
        if product.status not in from_statuses:
            raise DRFValidationError({"status": f"محصول در وضعیت «{product.get_status_display()}» قابل این عملیات نیست."})

        serializer = ProductWorkflowActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product.status = to_status
        product.updated_by = request.user
        if extra:
            extra(product, serializer.validated_data)

        try:
            product.full_clean()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        product.save()

        return Response(CMSProductDetailSerializer(product, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="submit-review")
    def submit_review(self, request, pk=None):
        return self._transition(
            request, pk, from_statuses=(Product.Status.DRAFT, Product.Status.REJECTED),
            to_status=Product.Status.WAITING_REVIEW,
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._transition(
            request, pk, from_statuses=(Product.Status.WAITING_REVIEW,), to_status=Product.Status.APPROVED,
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._transition(
            request, pk, from_statuses=(Product.Status.WAITING_REVIEW, Product.Status.APPROVED),
            to_status=Product.Status.REJECTED,
        )

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار محصول را دارد.")

        def _set_publish_fields(product, data):
            product.published_at = data.get("published_at") or timezone.localdate()
            product.published_by = request.user

        return self._transition(
            request, pk, from_statuses=(Product.Status.APPROVED,), to_status=Product.Status.PUBLISHED,
            extra=_set_publish_fields,
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        product = self.get_object()
        serializer = ProductWorkflowActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product.status = Product.Status.ARCHIVED
        product.updated_by = request.user
        product.save(update_fields=["status", "updated_by", "updated_at"])
        return Response(CMSProductDetailSerializer(product, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return self._transition(
            request, pk, from_statuses=(Product.Status.ARCHIVED,), to_status=Product.Status.DRAFT,
        )

    @action(detail=True, methods=["post"], url_path="upload-image")
    def upload_image(self, request, pk=None):
        product = self.get_object()
        serializer = CMSProductImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = ProductImage(
            product=product,
            image=serializer.validated_data["image"],
            alt_text=serializer.validated_data.get("alt_text"),
            caption=serializer.validated_data.get("caption"),
        )
        try:
            image.full_clean()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        image.save()

        return Response(
            CMSProductImageSerializer(image, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
