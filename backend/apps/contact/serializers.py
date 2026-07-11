from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import ContactInfo, ContactMessage


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


class ContactInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInfo
        fields = (
            "title",
            "description",
            "address",
            "phone",
            "phone_secondary",
            "email",
            "working_hours",
            "map_url",
            "latitude",
            "longitude",
        )
        read_only_fields = fields


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = (
            "full_name",
            "phone",
            "email",
            "subject",
            "message",
        )

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, "copy") else dict(data)
        if not payload.get("full_name") and payload.get("name"):
            payload["full_name"] = payload["name"]
        return super().to_internal_value(payload)

    def validate(self, attrs):
        phone = attrs.get("phone")
        email = attrs.get("email")
        message = attrs.get("message")

        errors = {}

        if not phone and not email:
            errors["phone"] = "حداقل یکی از شماره تماس یا ایمیل الزامی است."
            errors["email"] = "حداقل یکی از شماره تماس یا ایمیل الزامی است."

        if message and len(message.strip()) < 10:
            errors["message"] = "متن پیام باید حداقل ۱۰ کاراکتر باشد."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        if request is not None:
            validated_data["ip_address"] = self._get_client_ip(request)
            validated_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")[:1000]

        try:
            return ContactMessage.objects.create(**validated_data)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def _get_client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")


class ContactMessageSuccessSerializer(serializers.Serializer):
    message = serializers.CharField()


class CMSContactMessageSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = (
            "id",
            "full_name",
            "name",
            "phone",
            "email",
            "subject",
            "message",
            "status",
            "is_read",
            "admin_note",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "full_name",
            "name",
            "is_read",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        )

    def get_is_read(self, obj):
        return obj.status != ContactMessage.Status.NEW


class CMSContactMessageUpdateSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = ContactMessage
        fields = (
            "status",
            "admin_note",
            "is_read",
        )

    def update(self, instance, validated_data):
        is_read = validated_data.pop("is_read", None)
        if is_read is True and "status" not in validated_data:
            validated_data["status"] = ContactMessage.Status.SEEN
        elif is_read is False and "status" not in validated_data:
            validated_data["status"] = ContactMessage.Status.NEW
        return super().update(instance, validated_data)

    def validate_status(self, value):
        valid_statuses = {
            ContactMessage.Status.NEW,
            ContactMessage.Status.SEEN,
            ContactMessage.Status.ANSWERED,
            ContactMessage.Status.ARCHIVED,
        }

        if value not in valid_statuses:
            raise serializers.ValidationError("وضعیت پیام معتبر نیست.")

        return value
