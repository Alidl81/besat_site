from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.selectors import get_or_create_user_profile
from apps.news.permissions import get_accessible_unit_ids, is_general_manager
from apps.units.models import SchoolUnit

from .models import InternalMessage, Program, SchoolClass, Student


User = get_user_model()


class UnitScopedSerializerMixin:
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context["request"]
        unit = attrs.get("unit", self.instance.unit if self.instance else None)
        accessible_ids = get_accessible_unit_ids(request.user)

        if unit is None and not is_general_manager(request.user) and len(accessible_ids) == 1:
            unit = SchoolUnit.objects.get(pk=accessible_ids[0])
            attrs["unit"] = unit

        if not is_general_manager(request.user):
            if unit is None or unit.id not in accessible_ids:
                raise serializers.ValidationError(
                    {"unit_id": "واحد انتخاب‌شده در محدوده دسترسی شما نیست."}
                )
        return attrs


class StudentSerializer(UnitScopedSerializerMixin, serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Student
        fields = (
            "id", "full_name", "national_code", "unit_id", "class_title",
            "parent_id", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SchoolClassSerializer(UnitScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = ("id", "title", "unit_id", "grade", "capacity", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ProgramSerializer(UnitScopedSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ("id", "title", "description", "unit_id", "date", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class InternalMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.SerializerMethodField()
    recipient_id = serializers.SerializerMethodField()
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = InternalMessage
        fields = (
            "id", "sender_id", "sender_name", "sender_role", "recipient_id",
            "recipient_name", "recipient_role", "subject", "body", "is_read",
            "unit_id", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "sender_id", "sender_name", "sender_role", "recipient_id",
            "recipient_name", "recipient_role", "created_at", "updated_at",
        )

    def get_sender_id(self, obj):
        return f"user-{obj.sender.get_username()}" if obj.sender_id else None

    def get_recipient_id(self, obj):
        return f"user-{obj.recipient.get_username()}" if obj.recipient_id else None


class InternalMessageCreateSerializer(serializers.ModelSerializer):
    recipient_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = InternalMessage
        fields = ("recipient_id", "recipient_role", "subject", "body", "unit_id")

    def create(self, validated_data):
        request = self.context["request"]
        recipient_reference = validated_data.pop("recipient_id", None)
        recipient = None
        if recipient_reference:
            value = str(recipient_reference)
            try:
                if value.startswith("user-"):
                    recipient = User.objects.get(username=value[5:])
                else:
                    recipient = User.objects.get(pk=int(value))
            except (User.DoesNotExist, TypeError, ValueError):
                raise serializers.ValidationError({"recipient_id": "گیرنده معتبر نیست."})

        sender_profile = get_or_create_user_profile(request.user)
        recipient_profile = get_or_create_user_profile(recipient) if recipient else None
        requested_recipient_role = validated_data.pop("recipient_role", None)
        return InternalMessage.objects.create(
            sender=request.user,
            recipient=recipient,
            sender_name=sender_profile.full_name or request.user.get_username(),
            sender_role=sender_profile.role,
            recipient_name=(
                recipient_profile.full_name or recipient.get_username()
                if recipient else "همه"
            ),
            recipient_role=(recipient_profile.role if recipient_profile else requested_recipient_role),
            **validated_data,
        )
