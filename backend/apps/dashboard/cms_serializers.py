from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers

from apps.accounts.models import UserProfile
from apps.accounts.selectors import get_or_create_user_profile
from apps.news.permissions import get_accessible_unit_ids, is_general_manager
from apps.units.models import SchoolUnit

from .models import InternalMessage, Program, SchoolClass, Student


User = get_user_model()


def get_message_recipient_queryset(user):
    """Users `user` is allowed to send an internal message to. Shared by the recipients list and create validation so they can never drift apart."""
    queryset = User.objects.filter(is_active=True).exclude(pk=user.pk)

    if not is_general_manager(user):
        accessible_unit_ids = get_accessible_unit_ids(user)
        queryset = queryset.filter(
            Q(profile__role=UserProfile.Role.GENERAL_MANAGER)
            | Q(unit_memberships__unit_id__in=accessible_unit_ids)
        )

    return queryset.distinct()


def resolve_recipient_reference(value):
    text_value = str(value)

    try:
        if text_value.startswith("user-"):
            return User.objects.get(username=text_value[5:])

        return User.objects.get(pk=int(text_value))
    except (User.DoesNotExist, TypeError, ValueError):
        return None


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
    sender = serializers.SerializerMethodField()
    recipient = serializers.SerializerMethodField()
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
            "id", "sender", "recipient", "sender_id", "sender_name", "sender_role", "recipient_id",
            "recipient_name", "recipient_role", "subject", "body", "is_read",
            "unit_id", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "sender", "recipient", "sender_id", "sender_name", "sender_role", "recipient_id",
            "recipient_name", "recipient_role", "created_at", "updated_at",
        )

    def get_sender_id(self, obj):
        return f"user-{obj.sender.get_username()}" if obj.sender_id else None

    def get_sender(self, obj):
        return {
            "id": self.get_sender_id(obj),
            "full_name": obj.sender_name,
            "role_display": UserProfile.Role(obj.sender_role).label,
        }

    def get_recipient_id(self, obj):
        return f"user-{obj.recipient.get_username()}" if obj.recipient_id else None

    def get_recipient(self, obj):
        role_display = (
            UserProfile.Role(obj.recipient_role).label
            if obj.recipient_role
            else "همه"
        )
        return {
            "id": self.get_recipient_id(obj) or f"role-{obj.recipient_role or 'all'}",
            "full_name": obj.recipient_name,
            "role_display": role_display,
        }


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

    def validate_recipient_id(self, value):
        if not value:
            return value

        request = self.context["request"]
        recipient = resolve_recipient_reference(value)

        if recipient is None:
            raise serializers.ValidationError("گیرنده انتخاب‌شده معتبر نیست.")

        if recipient.pk == request.user.pk:
            raise serializers.ValidationError("نمی‌توانید برای خودتان پیام ارسال کنید.")

        if not get_message_recipient_queryset(request.user).filter(pk=recipient.pk).exists():
            raise serializers.ValidationError("گیرنده انتخاب‌شده معتبر نیست.")

        self._recipient = recipient
        return value

    def create(self, validated_data):
        request = self.context["request"]
        validated_data.pop("recipient_id", None)
        recipient = getattr(self, "_recipient", None)

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
