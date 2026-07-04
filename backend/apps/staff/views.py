from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import StaffMember
from .permissions import (
    HasStaffCMSPermission,
    get_unit_manager_unit_ids,
    is_general_manager,
)
from .serializers import (
    CMSStaffMemberDetailSerializer,
    CMSStaffMemberListSerializer,
    CMSStaffMemberWriteSerializer,
    StaffMemberDetailSerializer,
    StaffMemberListSerializer,
)


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    raise DRFValidationError(error.messages)


def parse_bool_param(value):
    if value is None:
        return None

    normalized = value.strip().lower()

    if normalized in ("true", "1", "yes"):
        return True

    if normalized in ("false", "0", "no"):
        return False

    return None


@extend_schema_view(
    list=extend_schema(
        tags=["Staff"],
        summary="List active staff members",
        parameters=[
            OpenApiParameter("page", int, required=False),
            OpenApiParameter("scope", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("department_id", int, required=False),
            OpenApiParameter("staff_type", str, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["Staff"],
        summary="Retrieve active staff member by slug",
        responses=StaffMemberDetailSerializer,
    ),
)
class StaffMemberViewSet(ReadOnlyModelViewSet):
    queryset = StaffMember.objects.none()
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "full_name",
        "role_title",
        "bio",
        "department__title",
        "unit__title",
    )
    ordering_fields = (
        "order",
        "full_name",
        "created_at",
    )
    ordering = (
        "order",
        "full_name",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StaffMember.objects.none()

        queryset = (
            StaffMember.objects.select_related("unit", "department")
            .filter(is_active=True)
            .exclude(
                unit__isnull=False,
                unit__is_active=False,
            )
            .exclude(
                department__isnull=False,
                department__is_active=False,
            )
            .order_by("order", "full_name", "-id")
        )

        scope = self.request.query_params.get("scope")

        if scope:
            queryset = queryset.filter(scope=scope)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

        department_id = self.request.query_params.get("department_id")

        if department_id:
            queryset = queryset.filter(department_id=department_id)

        staff_type = self.request.query_params.get("staff_type")

        if staff_type:
            queryset = queryset.filter(staff_type=staff_type)

        featured = parse_bool_param(self.request.query_params.get("featured"))

        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return StaffMemberDetailSerializer

        return StaffMemberListSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS list staff members",
        parameters=[
            OpenApiParameter("scope", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("department_id", int, required=False),
            OpenApiParameter("staff_type", str, required=False),
            OpenApiParameter("featured", bool, required=False),
            OpenApiParameter("active", bool, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    create=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS create staff member",
    ),
    retrieve=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS retrieve staff member",
    ),
    update=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS update staff member",
    ),
    partial_update=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS partially update staff member",
    ),
    destroy=extend_schema(
        tags=["CMS - Staff"],
        summary="CMS delete staff member",
    ),
)
class CMSStaffMemberViewSet(ModelViewSet):
    queryset = StaffMember.objects.none()
    permission_classes = [HasStaffCMSPermission]
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
        "full_name",
        "slug",
        "role_title",
        "bio",
        "email",
        "phone",
        "department__title",
        "unit__title",
    )
    ordering_fields = (
        "order",
        "full_name",
        "created_at",
        "updated_at",
    )
    ordering = (
        "order",
        "full_name",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StaffMember.objects.none()

        queryset = (
            StaffMember.objects.select_related(
                "unit",
                "department",
                "created_by",
                "updated_by",
            )
            .order_by("order", "full_name", "-id")
        )

        if not is_general_manager(self.request.user):
            unit_ids = get_unit_manager_unit_ids(self.request.user)

            if not unit_ids:
                return StaffMember.objects.none()

            queryset = queryset.filter(
                scope=StaffMember.Scope.UNIT,
                unit_id__in=unit_ids,
            )

        scope = self.request.query_params.get("scope")

        if scope:
            queryset = queryset.filter(scope=scope)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

        department_id = self.request.query_params.get("department_id")

        if department_id:
            queryset = queryset.filter(department_id=department_id)

        staff_type = self.request.query_params.get("staff_type")

        if staff_type:
            queryset = queryset.filter(staff_type=staff_type)

        featured = parse_bool_param(self.request.query_params.get("featured"))

        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        active = parse_bool_param(self.request.query_params.get("active"))

        if active is not None:
            queryset = queryset.filter(is_active=active)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CMSStaffMemberListSerializer

        if self.action in (
            "create",
            "update",
            "partial_update",
        ):
            return CMSStaffMemberWriteSerializer

        return CMSStaffMemberDetailSerializer

    def perform_create(self, serializer):
        self._validate_create_scope(serializer)

        try:
            serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def perform_update(self, serializer):
        self._validate_update_scope(serializer)

        try:
            serializer.save(
                updated_by=self.request.user,
            )
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _validate_create_scope(self, serializer):
        if is_general_manager(self.request.user):
            return

        scope = serializer.validated_data.get("scope", StaffMember.Scope.UNIT)
        unit = serializer.validated_data.get("unit")

        if scope != StaffMember.Scope.UNIT:
            raise PermissionDenied("مدیر واحد فقط می‌تواند عضو کادر واحد خودش را ایجاد کند.")

        if unit is None:
            raise DRFValidationError(
                {
                    "unit": "انتخاب واحد برای مدیر واحد الزامی است.",
                }
            )

        unit_ids = get_unit_manager_unit_ids(self.request.user)

        if unit.id not in unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")

    def _validate_update_scope(self, serializer):
        if is_general_manager(self.request.user):
            return

        instance = self.get_object()

        if instance.scope != StaffMember.Scope.UNIT:
            raise PermissionDenied("شما به این عضو کادر دسترسی ندارید.")

        unit_ids = get_unit_manager_unit_ids(self.request.user)

        new_unit = serializer.validated_data.get("unit", instance.unit)

        if not new_unit or new_unit.id not in unit_ids:
            raise PermissionDenied("شما به این واحد دسترسی ندارید.")