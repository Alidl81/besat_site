from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .permissions import IsAuthenticatedAndActiveProfile
from .selectors import (
    get_or_create_user_profile,
    get_user_permissions_payload,
    get_user_units_payload,
)
from .serializers import (
    AvatarUploadSerializer,
    LoginSerializer,
    LogoutSerializer,
    MeSerializer,
    ProfileSerializer,
    UserPermissionsSerializer,
    UserUnitSerializer,
)


class LoginAPIView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Login and receive JWT tokens",
        request=LoginSerializer,
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshTokenAPIView(TokenRefreshView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Refresh JWT access token",
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = LogoutSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Logout by blacklisting refresh token",
        request=LogoutSerializer,
        responses={204: None},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = MeSerializer

    @extend_schema(
        tags=["Me"],
        summary="Get current user basic information",
        responses=MeSerializer,
    )
    def get(self, request):
        serializer = self.serializer_class(
            request.user,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)


class MeProfileAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = ProfileSerializer
    parser_classes = (
        JSONParser,
        FormParser,
        MultiPartParser,
    )

    @extend_schema(
        tags=["Me"],
        summary="Get current user profile",
        responses=ProfileSerializer,
    )
    def get(self, request):
        profile = get_or_create_user_profile(request.user)

        serializer = self.serializer_class(
            profile,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)

    @extend_schema(
        tags=["Me"],
        summary="Update current user profile",
        request=ProfileSerializer,
        responses=ProfileSerializer,
    )
    def patch(self, request):
        profile = get_or_create_user_profile(request.user)

        serializer = self.serializer_class(
            profile,
            data=request.data,
            partial=True,
            context={
                "request": request,
            },
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


class MeProfileAvatarAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = AvatarUploadSerializer
    parser_classes = (
        MultiPartParser,
        FormParser,
    )

    @extend_schema(
        tags=["Me"],
        summary="Upload current user avatar",
        request=AvatarUploadSerializer,
        responses=ProfileSerializer,
    )
    def post(self, request):
        profile = get_or_create_user_profile(request.user)

        serializer = self.serializer_class(
            profile,
            data=request.data,
            context={
                "request": request,
            },
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response_serializer = ProfileSerializer(
            profile,
            context={
                "request": request,
            },
        )

        return Response(response_serializer.data)


class MePermissionsAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = UserPermissionsSerializer

    @extend_schema(
        tags=["Me"],
        summary="Get current user role and permissions",
        responses=UserPermissionsSerializer,
    )
    def get(self, request):
        payload = get_user_permissions_payload(request.user)

        return Response(payload)


class MeUnitsAPIView(APIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = UserUnitSerializer

    @extend_schema(
        tags=["Me"],
        summary="Get current user's accessible units",
        responses=UserUnitSerializer(many=True),
    )
    def get(self, request):
        payload = get_user_units_payload(request.user)

        return Response(payload)