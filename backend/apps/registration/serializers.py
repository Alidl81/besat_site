from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.units.models import SchoolUnit

from .models import RegistrationInfo, RegistrationRequest


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


class RegistrationInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistrationInfo
        fields = (
            "title",
            "description",
            "is_open",
            "open_message",
            "closed_message",
            "required_documents",
            "notes",
        )
        read_only_fields = fields


class RegistrationUnitBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class RegistrationRequestCreateSerializer(serializers.ModelSerializer):
    requested_unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.filter(is_active=True),
    )

    class Meta:
        model = RegistrationRequest
        fields = (
            "student_full_name",
            "parent_full_name",
            "parent_phone",
            "parent_email",
            "requested_unit",
            "requested_grade",
            "description",
        )

    def validate(self, attrs):
        active_info = RegistrationInfo.objects.filter(is_active=True).first()

        if active_info is not None and not active_info.is_open:
            raise serializers.ValidationError(
                {
                    "registration": active_info.closed_message or "در حال حاضر ثبت‌نام بسته است.",
                }
            )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        if request is not None:
            validated_data["ip_address"] = self._get_client_ip(request)
            validated_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")[:1000]

        try:
            return RegistrationRequest.objects.create(**validated_data)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _get_client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")


class RegistrationRequestSuccessSerializer(serializers.Serializer):
    message = serializers.CharField()
    id = serializers.IntegerField()


class CMSRegistrationRequestSerializer(serializers.ModelSerializer):
    requested_unit = RegistrationUnitBriefSerializer(read_only=True)
    requested_unit_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = RegistrationRequest
        fields = (
            "id",
            "student_full_name",
            "parent_full_name",
            "parent_phone",
            "parent_email",
            "requested_unit",
            "requested_unit_id",
            "requested_grade",
            "description",
            "status",
            "admin_note",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "student_full_name",
            "parent_full_name",
            "parent_phone",
            "parent_email",
            "requested_unit",
            "requested_unit_id",
            "requested_grade",
            "description",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        )


class CMSRegistrationRequestUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistrationRequest
        fields = (
            "status",
            "admin_note",
        )

    def validate_status(self, value):
        valid_statuses = {
            RegistrationRequest.Status.NEW,
            RegistrationRequest.Status.REVIEWING,
            RegistrationRequest.Status.CONTACTED,
            RegistrationRequest.Status.ACCEPTED,
            RegistrationRequest.Status.REJECTED,
            RegistrationRequest.Status.ARCHIVED,
        }

        if value not in valid_statuses:
            raise serializers.ValidationError("وضعیت درخواست معتبر نیست.")

        return value