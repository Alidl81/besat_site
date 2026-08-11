"""Public, self-service customer registration for the shop.

This is intentionally a separate, additive path from the staff-issued
UserInvitation flow used everywhere else in this app (apps.accounts.cms,
SetPasswordAPIView) -- it does not import from `invitations` and does not
touch that model. It exists specifically because, before this file,
there was no way for a visitor to create their own account at all;
customer accounts had to be created by staff. Every account created here
is hard-coded to the `parent` role -- this endpoint can never create a
staff/CMS role.

No email-verification step exists yet: this repo has no transactional-
email delivery configured for arbitrary recipients (EMAIL_HOST is
commonly unset in dev, see config/settings/base.py), so verification
would silently do nothing. Flagged here as a known, temporary v1
limitation rather than silently skipped."""

import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.utils import normalize_text, throttle_rate_configured

from .models import UserProfile
from .selectors import get_or_create_user_profile, get_role_redirect_path
from .serializers import MeSerializer

logger = logging.getLogger(__name__)

User = get_user_model()


class PublicCustomerRegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_full_name(self, value):
        value = normalize_text(value)
        if not value:
            raise serializers.ValidationError("نام کامل الزامی است.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists() or User.objects.filter(
            username__iexact=value
        ).exists():
            raise serializers.ValidationError("حساب کاربری با این ایمیل قبلاً ثبت شده است.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "رمز عبور و تکرار آن یکسان نیستند."})

        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})

        return attrs

    def save(self, **kwargs):
        email = self.validated_data["email"]
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=email, email=email, password=self.validated_data["password"]
                )
                profile = get_or_create_user_profile(user)
                profile.role = UserProfile.Role.PARENT
                profile.full_name = self.validated_data["full_name"]
                profile.phone = normalize_text(self.validated_data.get("phone", "")) or None
                profile.save()
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"email": "حساب کاربری با این ایمیل قبلاً ثبت شده است."}
            ) from exc

        logger.info("customer self-registration: user_id=%s", user.id)
        return user


class PublicCustomerRegisterAPIView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PublicCustomerRegisterSerializer
    throttle_scope = "customer_registration"

    def get_throttles(self):
        if throttle_rate_configured(self.throttle_scope):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @extend_schema(
        tags=["Auth"],
        summary="Public self-service customer (parent) registration for the shop",
        request=PublicCustomerRegisterSerializer,
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Built independently from LoginSerializer (deliberately -- this
        # endpoint never re-authenticates a password, it just issued one),
        # but produces the exact same response shape so the existing
        # frontend session-cookie flow (frontend/src/app/api/session/route.ts)
        # handles it without any changes.
        refresh = RefreshToken.for_user(user)
        profile = get_or_create_user_profile(user)

        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": MeSerializer(user, context={"request": request}).data,
            "redirect_path": get_role_redirect_path(profile.role),
        }
        return Response(data, status=status.HTTP_201_CREATED)
