from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth.password_validation import validate_password   

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import UserProfile
from .selectors import (
    get_or_create_user_profile,
    get_role_redirect_path,
    get_user_permissions_payload,
)
from .validators import validate_avatar_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_avatar_or_error(value):
    try:
        validate_avatar_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        profile = get_or_create_user_profile(self.user)

        if not profile.is_active:
            raise AuthenticationFailed("حساب کاربری شما غیرفعال است.")

        data["user"] = MeSerializer(
            self.user,
            context=self.context,
        ).data
        data["redirect_path"] = get_role_redirect_path(profile.role)

        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.token = attrs["refresh"]
        return attrs

    def save(self, **kwargs):
        try:
            RefreshToken(self.token).blacklist()
        except TokenError as exc:
            raise serializers.ValidationError(
                {
                    "refresh": "توکن refresh معتبر نیست یا قبلاً غیرفعال شده است.",
                }
            ) from exc


class MeSerializer(AbsoluteMediaURLMixin, serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True, allow_blank=True)
    full_name = serializers.CharField(read_only=True, allow_null=True)
    phone = serializers.CharField(read_only=True, allow_null=True)
    avatar = serializers.URLField(read_only=True, allow_null=True)
    role = serializers.CharField(read_only=True)
    role_display = serializers.CharField(read_only=True)
    redirect_path = serializers.CharField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)

    def to_representation(self, user):
        profile = get_or_create_user_profile(user)

        return {
            "id": user.id,
            "username": user.get_username(),
            "email": user.email or "",
            "full_name": profile.full_name,
            "phone": profile.phone,
            "avatar": self.build_absolute_media_url(profile.avatar),
            "role": profile.role,
            "role_display": profile.get_role_display(),
            "redirect_path": get_role_redirect_path(profile.role),
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }


class ProfileSerializer(AbsoluteMediaURLMixin, serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    full_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    avatar = serializers.URLField(read_only=True, allow_null=True)
    role = serializers.CharField(read_only=True)
    role_display = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def to_representation(self, profile):
        user = profile.user

        return {
            "id": user.id,
            "username": user.get_username(),
            "email": user.email or "",
            "full_name": profile.full_name,
            "phone": profile.phone,
            "description": profile.description,
            "avatar": self.build_absolute_media_url(profile.avatar),
            "role": profile.role,
            "role_display": profile.get_role_display(),
            "is_active": profile.is_active,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
        }

    def update(self, profile, validated_data):
        email = validated_data.pop("email", None)

        if email is not None:
            profile.user.email = email.strip()
            profile.user.save(update_fields=["email"])

        for field_name in (
            "full_name",
            "phone",
            "description",
        ):
            if field_name in validated_data:
                value = validated_data[field_name]

                if isinstance(value, str):
                    value = " ".join(value.strip().split()) or None

                setattr(profile, field_name, value)

        profile.full_clean()
        profile.save()

        return profile


class AvatarUploadSerializer(serializers.Serializer):
    avatar = serializers.ImageField(write_only=True)

    def validate_avatar(self, value):
        return validate_avatar_or_error(value)

    def update(self, profile, validated_data):
        profile.avatar = validated_data["avatar"]
        profile.full_clean()
        profile.save(update_fields=["avatar", "updated_at"])

        return profile

class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate_current_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError("رمز عبور فعلی نادرست است.")
        
        return value
    
    def validate(self, attrs):
        user = self.context["request"].user
        new_password = attrs.get("new_password")
        new_password_confirm = attrs.get("new_password_confirm")

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {
                    "new_password_confirm": "تکرار رمز عبور جدید با رمز عبور جدید یکسان نیست.",
                }
            )
        
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
            
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])

        return user
    
class UserUnitSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    access_role = serializers.CharField()
    access_role_display = serializers.CharField()


class UserPermissionsSerializer(serializers.Serializer):
    role = serializers.CharField()
    role_display = serializers.CharField()
    redirect_path = serializers.CharField()
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    permissions = serializers.DictField()
    django_permissions = serializers.ListField(
        child=serializers.CharField(),
    )


class PermissionPayloadSerializer(serializers.Serializer):
    detail = UserPermissionsSerializer()