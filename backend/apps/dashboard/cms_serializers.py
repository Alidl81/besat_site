from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.accounts.selectors import get_or_create_user_profile
from apps.news.permissions import get_accessible_unit_ids, is_general_manager
from apps.units.models import SchoolUnit

from .models import InternalMessage, Program, SchoolClass, Student


User = get_user_model()


def get_message_recipient_queryset(user):
    """Users `user` is allowed to send an internal message to. Shared by the recipients list and create validation so they can never drift apart.

    AUTH-DASH-MESSAGES-001: `is_active=True` alone only checks the Django
    User account, not the app-level UserProfile.is_active flag this system
    actually uses to deactivate a staff/parent account -- a profile-
    deactivated user (account suspended, but the underlying User row and
    any still-valid JWT untouched) was still offered as a selectable
    message recipient and could still send/receive through this endpoint.
    """
    queryset = User.objects.filter(is_active=True, profile__is_active=True).exclude(pk=user.pk)

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


class UnitScopedSerializerMixin(serializers.Serializer):
    # Must inherit from serializers.Serializer, not be a plain object mixin
    # -- DRF's SerializerMetaclass only collects a class's declared fields
    # into `_declared_fields` when that class itself goes through the
    # metaclass. A plain-object mixin's `unit_id = PrimaryKeyRelatedField
    # (...)` below is never picked up by StudentSerializer/
    # SchoolClassSerializer/ProgramSerializer's own field collection --
    # ModelSerializer then falls back to auto-generating an unrelated,
    # silently READ-ONLY "unit_id" field instead (confirmed empirically:
    # StudentSerializer().fields["unit_id"] was a bare ReadOnlyField(), not
    # this PrimaryKeyRelatedField, before this fix). Net effect: a
    # client-supplied unit_id was NEVER actually written to the model
    # through any of these three serializers -- the only reason existing
    # single-accessible-unit users' requests ever ended up with the right
    # unit was validate()'s own auto-default-to-the-one-accessible-unit
    # fallback below, which happens to coincide with what they'd have
    # explicitly requested anyway, masking the bug. A user with more than
    # one accessible unit had no way to pick which one via this field at
    # all. Discovered while adding multi-unit test coverage for
    # STUDENT-001, not itself part of that original finding.
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

    def validate_parent_id(self, value):
        # First-line, necessary-but-NOT-sufficient check: the target must
        # at least be a real Parent account, not staff/another unit
        # manager/anyone else. On its own this does NOT close the actual
        # exploit (STUDENT-001) -- a Unit Manager could still name a real,
        # but completely unrelated, Parent account (e.g. a stranger who
        # happens to be a parent at a different unit) and this check alone
        # would accept it. See validate() below for the actual
        # relationship requirement that closes that.
        if value is None:
            return value
        if get_or_create_user_profile(value).role != UserProfile.Role.PARENT:
            raise serializers.ValidationError("کاربر انتخاب‌شده والد نیست.")
        return value

    def validate(self, attrs):
        # The real STUDENT-001 fix: require the named parent to actually
        # have a standing relationship to the unit this student belongs to
        # -- an active UserUnitMembership(role=PARENT) for that unit,
        # which today is only ever created by a general manager through
        # the user-management admin endpoint (apps/accounts/cms.py). This
        # doesn't prove an exact family relationship, but it closes the
        # demonstrated exploit (a Unit Manager linking a totally unrelated
        # stranger's account) down to "an existing parent this unit's
        # management has already recognized," which general managers
        # remain exempt from since they already have unrestricted
        # authority everywhere else in this codebase.
        #
        # Checked against the EFFECTIVE final (parent, unit) pair after
        # this update -- not just whatever this one request happened to
        # include -- for two reasons a first version of this check missed:
        # (1) UnitScopedSerializerMixin.validate() above only writes
        # attrs["unit"] back in one narrow auto-default case; on a normal
        # update that omits unit_id, attrs has no "unit" key at all even
        # though the mixin resolved *a* unit locally to validate against,
        # so reading attrs.get("unit") here would wrongly see None even
        # for a legitimate same-unit parent reassignment. (2) a manager
        # with access to two units could otherwise PATCH only unit_id
        # (moving a student from unit A to unit B) while leaving parent_id
        # untouched -- the existing parent (recognized for A, not B) would
        # stay attached with no check ever running at all, since "parent"
        # wouldn't be a key in attrs either. Falling back to the current
        # instance's stored value for whichever field wasn't in THIS
        # request closes both gaps with one check that runs whenever
        # either side of the relationship could have changed.
        attrs = super().validate(attrs)
        if not is_general_manager(self.context["request"].user):
            parent = attrs.get("parent", self.instance.parent if self.instance else None)
            unit = attrs.get("unit", self.instance.unit if self.instance else None)
            if parent is not None:
                is_recognized_parent_of_unit = UserUnitMembership.objects.filter(
                    user=parent,
                    unit=unit,
                    role=UserUnitMembership.UnitRole.PARENT,
                    is_active=True,
                ).exists()
                if not is_recognized_parent_of_unit:
                    raise serializers.ValidationError(
                        {"parent_id": "این کاربر به‌عنوان والد این واحد ثبت نشده است."}
                    )
        return attrs

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

    def validate_recipient_role(self, value):
        if not value:
            return value
        valid_roles = {choice for choice, _ in UserProfile.Role.choices}
        if value not in valid_roles:
            raise serializers.ValidationError("نقش گیرنده معتبر نیست.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Gate on the NORMALIZED attrs, not self.initial_data: a first
        # version of this check read self.initial_data instead, which is
        # the raw, pre-trim input -- a whitespace-only "   " is truthy
        # there even though CharField's default trim_whitespace=True (in
        # validate_recipient_id, via allow_blank=True) normalizes it to
        # "", the same as a blank/omitted recipient. Checking attrs
        # correctly treats both "recipient_id" absent entirely (DRF skips
        # field-level validation for a required=False field that's not in
        # the input at all, so it's simply not a key here) and
        # "recipient_id" present-but-blank-after-trim as the same falsy
        # "no recipient" case -- exactly the broadcast case that needs the
        # general-manager gate, however the client phrases "no recipient".
        if not attrs.get("recipient_id"):
            request = self.context["request"]
            if not is_general_manager(request.user):
                raise serializers.ValidationError(
                    {"recipient_id": "گیرنده پیام را انتخاب کنید."}
                )
        return attrs

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
