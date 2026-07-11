from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.departments.models import Department
from apps.units.models import SchoolUnit

from .models import StaffMember
from .permissions import get_unit_manager_unit_ids, is_general_manager
from .validators import validate_staff_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_staff_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class StaffUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class StaffDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class StaffMemberListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    unit = StaffUnitSerializer(read_only=True)
    unit_id = serializers.IntegerField(read_only=True)
    department = StaffDepartmentSerializer(read_only=True)
    department_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = StaffMember
        fields = (
            "id",
            "full_name",
            "slug",
            "staff_type",
            "role_title",
            "bio",
            "avatar",
            "image",
            "email",
            "phone",
            "scope",
            "unit",
            "unit_id",
            "department",
            "department_id",
            "is_featured",
            "order",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_avatar(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.avatar)

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.avatar)


class StaffMemberDetailSerializer(StaffMemberListSerializer):
    class Meta(StaffMemberListSerializer.Meta):
        fields = StaffMemberListSerializer.Meta.fields
        read_only_fields = fields


class CMSStaffMemberListSerializer(StaffMemberListSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = StaffMember
        fields = StaffMemberListSerializer.Meta.fields + (
            "is_active",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSStaffMemberDetailSerializer(CMSStaffMemberListSerializer):
    class Meta(CMSStaffMemberListSerializer.Meta):
        fields = CMSStaffMemberListSerializer.Meta.fields
        read_only_fields = fields


class CMSStaffMemberWriteSerializer(serializers.ModelSerializer):
    unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
    )
    avatar = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = StaffMember
        fields = (
            "id",
            "full_name",
            "slug",
            "staff_type",
            "role_title",
            "bio",
            "avatar",
            "email",
            "phone",
            "scope",
            "unit",
            "unit_id",
            "department",
            "is_featured",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def validate_avatar(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate(self, attrs):
        scope = attrs.get(
            "scope",
            self.instance.scope if self.instance else StaffMember.Scope.SCHOOL,
        )
        unit = attrs.get(
            "unit",
            self.instance.unit if self.instance else None,
        )
        request = self.context.get("request")
        if (
            request
            and not is_general_manager(request.user)
            and unit is None
            and "scope" not in self.initial_data
        ):
            unit_ids = get_unit_manager_unit_ids(request.user)
            if len(unit_ids) == 1:
                unit = SchoolUnit.objects.get(pk=unit_ids[0])
                attrs["unit"] = unit
                attrs["scope"] = StaffMember.Scope.UNIT
                scope = StaffMember.Scope.UNIT
        department = attrs.get(
            "department",
            self.instance.department if self.instance else None,
        )

        if scope == StaffMember.Scope.UNIT and not unit:
            raise serializers.ValidationError(
                {
                    "unit": "برای عضو کادر واحدی، انتخاب واحد الزامی است.",
                }
            )

        if scope == StaffMember.Scope.SCHOOL and unit:
            raise serializers.ValidationError(
                {
                    "unit": "برای عضو کادر مدرسه‌ای نباید واحد انتخاب شود.",
                }
            )

        if unit and not unit.is_active:
            raise serializers.ValidationError(
                {
                    "unit": "واحد انتخاب‌شده فعال نیست.",
                }
            )

        if department and not department.is_active:
            raise serializers.ValidationError(
                {
                    "department": "دپارتمان انتخاب‌شده فعال نیست.",
                }
            )

        return attrs
