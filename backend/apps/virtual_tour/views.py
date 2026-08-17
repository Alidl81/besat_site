from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import TourHotspot, TourScene
from .permissions import (
    HasVirtualTourCMSPermission,
    get_accessible_unit_ids,
    is_general_manager,
    is_unit_manager,
    is_unit_media,
    user_can_review_tour_scene,
    user_can_submit_tour_scene,
)
from .serializers import (
    CMSTourSceneDetailSerializer,
    CMSTourSceneListSerializer,
    CMSTourSceneWriteSerializer,
    TourHotspotSerializer,
    TourSceneDetailSerializer,
    TourSceneListSerializer,
    TourWorkflowActionSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)
    raise DRFValidationError(error.messages)


@extend_schema_view(
    list=extend_schema(tags=["Virtual Tour"], summary="List published tour scenes"),
    retrieve=extend_schema(tags=["Virtual Tour"], summary="Retrieve a published tour scene by slug"),
)
class TourSceneViewSet(ReadOnlyModelViewSet):
    queryset = TourScene.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"
    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ("order", "title")
    ordering = ("order", "id")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TourScene.objects.none()

        today = timezone.localdate()
        queryset = (
            TourScene.objects.select_related("unit", "department")
            .prefetch_related("hotspots")
            .filter(
                is_active=True,
                status=TourScene.Status.PUBLISHED,
                published_at__isnull=False,
                published_at__lte=today,
            )
        )

        door = self.request.query_params.get("door")  # "unit:<slug>" or "department:<slug>"
        if door and ":" in door:
            door_type, door_slug = door.split(":", 1)
            if door_type == "unit":
                queryset = queryset.filter(unit__slug=door_slug)
            elif door_type == "department":
                queryset = queryset.filter(department__slug=door_slug)
            else:
                return TourScene.objects.none()

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TourSceneDetailSerializer
        return TourSceneListSerializer


@extend_schema_view(
    list=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS list tour scenes"),
    create=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS create tour scene"),
    retrieve=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS retrieve tour scene"),
    update=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS update tour scene"),
    partial_update=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS partially update tour scene"),
    destroy=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS delete tour scene"),
)
class CMSTourSceneViewSet(ModelViewSet):
    queryset = TourScene.objects.none()
    permission_classes = [HasVirtualTourCMSPermission]
    lookup_value_regex = r"\d+"
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "slug", "unit__title", "department__title")
    ordering_fields = ("created_at", "updated_at", "title", "status", "order")
    ordering = ("-updated_at", "-id")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TourScene.objects.none()

        queryset = TourScene.objects.select_related(
            "unit", "department", "created_by", "updated_by", "published_by"
        ).prefetch_related("hotspots")

        user = self.request.user
        if not (is_general_manager(user) or is_unit_manager(user) or is_unit_media(user)):
            return queryset.filter(
                is_active=True,
                status=TourScene.Status.PUBLISHED,
                published_at__lte=timezone.localdate(),
            )

        if not is_general_manager(user):
            accessible_unit_ids = get_accessible_unit_ids(user)
            if not accessible_unit_ids:
                return TourScene.objects.none()
            queryset = queryset.filter(unit_id__in=accessible_unit_ids)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        door_type = self.request.query_params.get("door_type")
        if door_type == "unit":
            queryset = queryset.filter(unit__isnull=False)
        elif door_type == "department":
            queryset = queryset.filter(department__isnull=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSTourSceneListSerializer
        if self.action in ("create", "update", "partial_update"):
            return CMSTourSceneWriteSerializer
        if self.action in ("submit_review", "approve", "publish", "reject", "archive", "restore"):
            return TourWorkflowActionSerializer
        return CMSTourSceneDetailSerializer

    def _ensure_user_can_write_payload(self, serializer):
        user = self.request.user
        if is_general_manager(user):
            return

        if not (is_unit_manager(user) or is_unit_media(user)):
            raise PermissionDenied("شما اجازه مدیریت تور مجازی را ندارید.")

        instance = serializer.instance
        unit = serializer.validated_data.get("unit", instance.unit if instance else None)
        department = serializer.validated_data.get(
            "department", instance.department if instance else None
        )
        status_value = serializer.validated_data.get(
            "status", instance.status if instance else TourScene.Status.DRAFT
        )

        if department is not None:
            raise PermissionDenied("فقط مدیر کل اجازه مدیریت صحنه‌های دپارتمانی را دارد.")

        if unit is None:
            raise PermissionDenied("انتخاب واحد آموزشی الزامی است.")

        from apps.accounts.models import UserUnitMembership

        allowed_roles = (
            (UserUnitMembership.UnitRole.UNIT_MANAGER,)
            if is_unit_manager(user)
            else (UserUnitMembership.UnitRole.UNIT_MEDIA,)
        )
        accessible_unit_ids = get_accessible_unit_ids(user, allowed_roles=allowed_roles)

        if unit.id not in accessible_unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

        if status_value in (TourScene.Status.APPROVED, TourScene.Status.PUBLISHED, TourScene.Status.ARCHIVED):
            raise PermissionDenied("شما اجازه ثبت مستقیم این وضعیت را ندارید.")

    def perform_create(self, serializer):
        self._ensure_user_can_write_payload(serializer)
        status_value = serializer.validated_data.get("status", TourScene.Status.DRAFT)
        published_by = self.request.user if status_value == TourScene.Status.PUBLISHED else None
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
        status_value = serializer.validated_data.get("status", serializer.instance.status)
        extra_fields = {"updated_by": self.request.user}
        if status_value == TourScene.Status.PUBLISHED and serializer.instance.published_by_id is None:
            extra_fields["published_by"] = self.request.user
        try:
            serializer.save(**extra_fields)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_destroy(self, instance):
        if not is_general_manager(self.request.user) and instance.department_id is not None:
            raise PermissionDenied("فقط مدیر کل اجازه حذف صحنه‌های دپارتمانی را دارد.")
        instance.delete()

    def _serialize_detail(self, scene):
        serializer = CMSTourSceneDetailSerializer(scene, context=self.get_serializer_context())
        return Response(serializer.data)

    def _save_or_raise(self, scene):
        try:
            scene.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    @action(detail=True, methods=["post"], url_path="submit-review")
    def submit_review(self, request, pk=None):
        scene = self.get_object()
        if not user_can_submit_tour_scene(request.user, scene):
            raise PermissionDenied("شما اجازه ارسال این صحنه برای بررسی را ندارید.")
        if scene.status not in (TourScene.Status.DRAFT, TourScene.Status.REJECTED):
            raise DRFValidationError({"status": "فقط صحنه پیش‌نویس یا ردشده قابل ارسال برای بررسی است."})
        scene.status = TourScene.Status.WAITING_REVIEW
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        scene = self.get_object()
        if not user_can_review_tour_scene(request.user, scene):
            raise PermissionDenied("شما اجازه تأیید این صحنه را ندارید.")
        if scene.status != TourScene.Status.WAITING_REVIEW:
            raise DRFValidationError({"status": "فقط صحنه در انتظار بررسی قابل تأیید است."})
        scene.status = TourScene.Status.APPROVED
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        scene = self.get_object()
        if not is_general_manager(request.user):
            raise PermissionDenied("فقط مدیر کل اجازه انتشار صحنه تور مجازی را دارد.")
        if scene.status != TourScene.Status.APPROVED:
            raise DRFValidationError({"status": "فقط صحنه تأییدشده قابل انتشار است."})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scene.status = TourScene.Status.PUBLISHED
        scene.published_at = serializer.validated_data.get("published_at") or timezone.localdate()
        scene.published_by = request.user
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        scene = self.get_object()
        if not user_can_review_tour_scene(request.user, scene):
            raise PermissionDenied("شما اجازه رد کردن این صحنه را ندارید.")
        if scene.status not in (TourScene.Status.WAITING_REVIEW, TourScene.Status.APPROVED):
            raise DRFValidationError({"status": "فقط صحنه در انتظار بررسی یا تأییدشده قابل رد شدن است."})
        scene.status = TourScene.Status.REJECTED
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        scene = self.get_object()
        if not user_can_review_tour_scene(request.user, scene):
            raise PermissionDenied("شما اجازه آرشیو کردن این صحنه را ندارید.")
        scene.status = TourScene.Status.ARCHIVED
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        scene = self.get_object()
        if not user_can_review_tour_scene(request.user, scene):
            raise PermissionDenied("شما اجازه بازیابی این صحنه را ندارید.")
        if scene.status != TourScene.Status.ARCHIVED:
            raise DRFValidationError({"status": "فقط صحنه آرشیوشده قابل بازیابی است."})
        scene.status = TourScene.Status.DRAFT
        scene.updated_by = request.user
        self._save_or_raise(scene)
        return self._serialize_detail(scene)


@extend_schema_view(
    list=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS list tour hotspots"),
    create=extend_schema(tags=["CMS - Virtual Tour"], summary="CMS create tour hotspot"),
)
class CMSTourHotspotViewSet(ModelViewSet):
    queryset = TourHotspot.objects.none()
    serializer_class = TourHotspotSerializer
    permission_classes = [HasVirtualTourCMSPermission]
    filterset_fields = ("scene",)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TourHotspot.objects.none()

        queryset = TourHotspot.objects.select_related("scene", "target_scene")
        user = self.request.user

        if not (is_general_manager(user) or is_unit_manager(user) or is_unit_media(user)):
            return TourHotspot.objects.none()

        if not is_general_manager(user):
            accessible_unit_ids = get_accessible_unit_ids(user)
            queryset = queryset.filter(scene__unit_id__in=accessible_unit_ids)

        scene_id = self.request.query_params.get("scene")
        if scene_id:
            queryset = queryset.filter(scene_id=scene_id)

        return queryset

    def _ensure_can_write_scene(self, scene):
        user = self.request.user
        if is_general_manager(user):
            return
        if scene.department_id is not None:
            raise PermissionDenied("فقط مدیر کل اجازه مدیریت نقاط اتصال دپارتمانی را دارد.")
        if scene.unit_id not in get_accessible_unit_ids(user):
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

    def perform_create(self, serializer):
        scene = serializer.validated_data["scene"]
        self._ensure_can_write_scene(scene)
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_update(self, serializer):
        scene = serializer.validated_data.get("scene", serializer.instance.scene)
        self._ensure_can_write_scene(scene)
        try:
            serializer.save()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_destroy(self, instance):
        self._ensure_can_write_scene(instance.scene)
        instance.delete()
