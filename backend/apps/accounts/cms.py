from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.viewsets import GenericViewSet

from apps.news.permissions import is_general_manager
from apps.units.models import SchoolUnit

from .models import UserProfile, UserUnitMembership
from .selectors import get_or_create_user_profile


User = get_user_model()


class CMSUserCompatibilitySerializer(serializers.Serializer):
    id = serializers.CharField()
    username = serializers.CharField()
    full_name = serializers.CharField(allow_blank=True)
    email = serializers.EmailField(allow_null=True)
    phone = serializers.CharField(allow_null=True)
    role = serializers.CharField()
    unit_id = serializers.CharField(allow_null=True)
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


def primary_membership(user):
    return (
        UserUnitMembership.objects.filter(user=user, is_active=True)
        .select_related("unit")
        .order_by("id")
        .first()
    )


def serialize_cms_user(user):
    profile = get_or_create_user_profile(user)
    membership = primary_membership(user)
    return {
        "id": str(user.id),
        "username": user.get_username(),
        "full_name": profile.full_name or "",
        "email": user.email or None,
        "phone": profile.phone,
        "role": profile.role,
        "unit_id": str(membership.unit_id) if membership else None,
        "is_active": bool(user.is_active and profile.is_active),
        "created_at": user.date_joined,
        "updated_at": profile.updated_at,
    }


class CMSUserViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CMSUserCompatibilitySerializer

    def list(self, request):
        users = User.objects.all().order_by("id")
        return Response([serialize_cms_user(user) for user in users])

    def retrieve(self, request, pk=None):
        return Response(serialize_cms_user(self._get_user(pk)))

    @transaction.atomic
    def create(self, request):
        self._ensure_manager(request.user)
        username = str(request.data.get("username") or "").strip()
        if not username:
            raise ValidationError({"username": "نام کاربری الزامی است."})
        if User.objects.filter(username=username).exists():
            raise ValidationError({"username": "این نام کاربری قبلاً ثبت شده است."})

        user = User.objects.create_user(
            username=username,
            email=(request.data.get("email") or "").strip(),
            password=None,
        )
        self._apply_payload(user, request.data)
        return Response(serialize_cms_user(user), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        return self._update(request, pk)

    def partial_update(self, request, pk=None):
        return self._update(request, pk)

    @transaction.atomic
    def destroy(self, request, pk=None):
        self._ensure_manager(request.user)
        user = self._get_user(pk)
        if user == request.user:
            raise ValidationError({"user": "حذف حساب کاربری فعلی مجاز نیست."})
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @transaction.atomic
    def _update(self, request, pk):
        self._ensure_manager(request.user)
        user = self._get_user(pk)
        if "username" in request.data:
            username = str(request.data["username"] or "").strip()
            if not username:
                raise ValidationError({"username": "نام کاربری الزامی است."})
            if User.objects.exclude(pk=user.pk).filter(username=username).exists():
                raise ValidationError({"username": "این نام کاربری قبلاً ثبت شده است."})
            user.username = username
        self._apply_payload(user, request.data)
        return Response(serialize_cms_user(user))

    def _apply_payload(self, user, data):
        profile = get_or_create_user_profile(user)

        if "email" in data:
            user.email = str(data.get("email") or "").strip()
        if "is_active" in data:
            user.is_active = bool(data["is_active"])
            profile.is_active = bool(data["is_active"])
        if "full_name" in data:
            profile.full_name = str(data.get("full_name") or "").strip() or None
        if "phone" in data:
            profile.phone = str(data.get("phone") or "").strip() or None
        if "role" in data:
            role = data["role"]
            valid_roles = {value for value, _ in UserProfile.Role.choices}
            if role not in valid_roles:
                raise ValidationError({"role": "نقش کاربری معتبر نیست."})
            profile.role = role

        user.save()
        profile.save()

        if "unit_id" in data or "role" in data:
            UserUnitMembership.objects.filter(user=user).delete()
            unit_id = data.get("unit_id")
            if unit_id and profile.role in (
                UserProfile.Role.UNIT_MANAGER,
                UserProfile.Role.UNIT_MEDIA,
                UserProfile.Role.PARENT,
            ):
                try:
                    unit = SchoolUnit.objects.get(pk=int(unit_id), is_active=True)
                except (SchoolUnit.DoesNotExist, TypeError, ValueError):
                    raise ValidationError({"unit_id": "واحد انتخاب‌شده معتبر نیست."})
                UserUnitMembership.objects.create(
                    user=user,
                    unit=unit,
                    role=profile.role,
                )

    @staticmethod
    def _get_user(pk):
        try:
            return User.objects.get(pk=pk)
        except (User.DoesNotExist, TypeError, ValueError):
            raise NotFound("کاربر یافت نشد.")

    @staticmethod
    def _ensure_manager(user):
        if not is_general_manager(user):
            raise PermissionDenied("فقط مدیر کل اجازه مدیریت کاربران را دارد.")
