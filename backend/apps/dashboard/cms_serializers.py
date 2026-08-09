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
    student_code = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()
    class_room = serializers.SerializerMethodField()
    major = serializers.SerializerMethodField()
    profile_status = serializers.SerializerMethodField()
    education_status = serializers.SerializerMethodField()
    guardian = serializers.SerializerMethodField()
    enrolled_at = serializers.DateTimeField(source="created_at", read_only=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Student
        fields = (
            "id", "full_name", "avatar_url", "student_code", "national_code",
            "unit", "unit_id", "grade", "class_room", "class_title", "major", "profile_status",
            "education_status", "guardian", "parent_id", "enrolled_at",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_student_code(self, obj) -> None:
        return None

    def get_avatar_url(self, obj) -> None:
        return None

    def get_unit(self, obj) -> dict[str, int | str] | None:
        if obj.unit_id is None:
            return None
        return {"id": obj.unit_id, "title": obj.unit.title}

    def get_grade(self, obj) -> None:
        return None

    def get_class_room(self, obj) -> dict[str, str] | None:
        if not obj.class_title:
            return None
        return {"id": obj.class_title, "title": obj.class_title}

    def get_major(self, obj) -> None:
        return None

    def get_profile_status(self, obj) -> str:
        required_values = (obj.full_name, obj.national_code, obj.unit_id, obj.class_title)
        return "complete" if all(required_values) else "incomplete"

    def get_education_status(self, obj) -> None:
        return None

    def get_guardian(self, obj) -> dict[str, object] | None:
        if obj.parent_id is None:
            return None
        profile = get_or_create_user_profile(obj.parent)
        return {
            "id": obj.parent_id,
            "full_name": profile.full_name or obj.parent.get_username(),
            "phone": profile.phone,
            "email": obj.parent.email or None,
        }


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
