import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as simplejwt_api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth.password_validation import validate_password

from apps.core.serializers import AbsoluteMediaURLMixin

from .invitations import find_invitation
from .models import UserProfile
from .selectors import (
    get_or_create_user_profile,
    get_role_redirect_path,
    get_user_permissions_payload,
    get_user_units_payload,
)
from .validators import validate_avatar_image_file


logger = logging.getLogger(__name__)


def revoke_all_outstanding_tokens(user) -> None:
    """Blacklists every refresh token this user has ever been issued that
    SIMPLE_JWT is still tracking as outstanding. Must be called on every
    password change/reset path (self-service and invitation-based) --
    without this, a session stolen before the change survives it: its
    still-valid refresh token can keep minting new access tokens
    indefinitely, and rotation/blacklist-on-refresh alone does nothing to
    cure an already-compromised chain that was never actually used to
    refresh. This does NOT invalidate that session's current *access*
    token (SIMPLE_JWT doesn't track/blacklist access tokens by default,
    only refresh tokens) -- a stolen access token remains usable for the
    remainder of its own short lifetime (ACCESS_TOKEN_LIFETIME); that
    residual window is an accepted, explicit limitation, not solved here.

    CONCURRENCY (AUTH-001): this function, by itself, reads an unlocked
    snapshot of OutstandingToken rows, then inserts blacklist rows for
    that snapshot. On its own, a holder of an old refresh token who
    refreshes in the narrow window between the snapshot query and the
    blacklist insert would get a newly rotated replacement token
    (rotation is enabled) that isn't in that snapshot and would survive
    indefinitely. This is closed NOT inside this function but by its
    callers: every caller below acquires
    `UserProfile.objects.select_for_update()` on the target user's
    profile row, inside the same `transaction.atomic()` block, BEFORE
    calling this function -- and `RefreshTokenSerializer.validate()`
    (this module) acquires the identical row lock, inside its own
    `transaction.atomic()`, before running the real (fully verified)
    refresh/rotation logic. That forces the two operations to serialize
    on that row: whichever side acquires the lock first fully completes
    (commits) before the other's blacklist-check/rotation logic runs, so
    a concurrent refresh either lands inside this function's snapshot
    (if the refresh committed its rotation first) or sees the old token
    as already blacklisted when it re-verifies under the lock (if the
    password change committed first). A caller that invokes this
    function WITHOUT already holding that lock reintroduces the race --
    this function has no way to enforce that its caller is already
    inside such a transaction.
    """
    outstanding_tokens = OutstandingToken.objects.filter(user=user)
    BlacklistedToken.objects.bulk_create(
        (
            BlacklistedToken(token=token)
            for token in outstanding_tokens
            if not hasattr(token, "blacklistedtoken")
        ),
        ignore_conflicts=True,
    )


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


class RefreshTokenSerializer(TokenRefreshSerializer):
    """Wraps the stock SIMPLE_JWT refresh/rotation logic in a per-user row
    lock on UserProfile so it can never interleave with
    revoke_all_outstanding_tokens()'s snapshot-then-blacklist sequence in
    ChangePasswordSerializer.save() / SetPasswordSerializer.save() --
    see AUTH-001 and the docstring on revoke_all_outstanding_tokens().

    A refresh request cannot authenticate itself before it has decoded
    the token, so we can't lock the row "properly" (via an authenticated
    user) before touching the token at all. Instead: peek at the
    unverified `user_id` claim (signature/expiry/blacklist NOT checked
    yet -- see _peek_user_id) purely to pick which profile row to lock,
    then run the real, fully-verified validation (which re-decodes the
    same token from scratch, checking signature/expiry/blacklist exactly
    as the stock serializer always has) inside that lock. The peek is
    never itself trusted for any authorization decision -- a forged or
    garbage `user_id` claim only causes us to (harmlessly) lock the
    wrong/a nonexistent profile row; the subsequent real validation still
    rejects the token normally.
    """

    def validate(self, attrs):
        user_id = self._peek_user_id(attrs.get("refresh", ""))

        if user_id is None:
            return super().validate(attrs)

        with transaction.atomic():
            UserProfile.objects.select_for_update().filter(user_id=user_id).first()
            return super().validate(attrs)

    @staticmethod
    def _peek_user_id(raw_token):
        try:
            token = RefreshToken(raw_token, verify=False)
        except TokenError:
            return None

        return token.payload.get(simplejwt_api_settings.USER_ID_CLAIM)


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
    unit_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)

    def to_representation(self, user):
        profile = get_or_create_user_profile(user)
        units = get_user_units_payload(user)

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
            "unit_id": units[0]["id"] if len(units) == 1 else None,
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
    redirect_path = serializers.CharField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    unit_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_active = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def to_representation(self, profile):
        user = profile.user

        units = get_user_units_payload(user)

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
            "redirect_path": get_role_redirect_path(profile.role),
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "unit_id": units[0]["id"] if len(units) == 1 else None,
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
    confirm_password = serializers.CharField(
        required=False,
        write_only=True,
        trim_whitespace=False,
    )
    new_password_confirm = serializers.CharField(
        required=False,
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
        confirm_password = attrs.get("confirm_password", attrs.get("new_password_confirm"))

        if confirm_password is None:
            raise serializers.ValidationError(
                {"confirm_password": "تکرار رمز عبور جدید الزامی است."}
            )

        if new_password != confirm_password:
            error_field = (
                "confirm_password"
                if "confirm_password" in attrs
                else "new_password_confirm"
            )
            raise serializers.ValidationError(
                {
                    error_field: "تکرار رمز عبور جدید با رمز عبور جدید یکسان نیست.",
                }
            )
        
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
            
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        with transaction.atomic():
            # AUTH-001: lock this user's profile row for the whole
            # revoke sequence so a concurrent refresh (see
            # RefreshTokenSerializer.validate()) can't slip a
            # newly-rotated descendant token past the snapshot taken
            # inside revoke_all_outstanding_tokens() below.
            UserProfile.objects.select_for_update().filter(user=user).first()

            user.set_password(self.validated_data["new_password"])
            user.save(update_fields=["password"])
            revoke_all_outstanding_tokens(user)

        return user

class SetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, trim_whitespace=False)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        invitation = find_invitation(attrs["token"])

        if invitation is None:
            logger.warning("user invitation rejected: reason=not_found")
            raise serializers.ValidationError({"token": "لینک دعوت نامعتبر است."})

        if invitation.used_at is not None:
            logger.warning(
                "user invitation rejected: reason=used invitation_id=%s", invitation.id,
            )
            raise serializers.ValidationError(
                {"token": "این لینک دعوت قبلاً استفاده شده است."}
            )

        if invitation.expires_at <= timezone.now():
            logger.warning(
                "user invitation rejected: reason=expired invitation_id=%s", invitation.id,
            )
            raise serializers.ValidationError({"token": "این لینک دعوت منقضی شده است."})

        try:
            validate_password(attrs["password"], user=invitation.user)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

        self.invitation = invitation
        return attrs

    def save(self, **kwargs):
        invitation = self.invitation
        user = invitation.user

        with transaction.atomic():
            # AUTH-001: same per-user row lock as ChangePasswordSerializer
            # -- see the comment there and revoke_all_outstanding_tokens()'s
            # docstring.
            UserProfile.objects.select_for_update().filter(user=user).first()

            user.set_password(self.validated_data["password"])
            user.save(update_fields=["password"])
            invitation.used_at = timezone.now()
            invitation.save(update_fields=["used_at"])
            revoke_all_outstanding_tokens(user)

        logger.info(
            "user invitation consumed: invitation_id=%s user_id=%s", invitation.id, user.id,
        )
        return user


class UserUnitSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    access_role = serializers.CharField()
    access_role_display = serializers.CharField()
    role = serializers.CharField()


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
