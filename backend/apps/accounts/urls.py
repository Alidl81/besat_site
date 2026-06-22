from django.urls import path

from .views import (
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    MePermissionsAPIView,
    MeProfileAPIView,
    MeProfileAvatarAPIView,
    MeUnitsAPIView,
    RefreshTokenAPIView,
)




app_name = "accounts"


urlpatterns = [
    path("auth/login/", LoginAPIView.as_view(), name="login"),
    path("auth/refresh/", RefreshTokenAPIView.as_view(), name="refresh-token"),
    path("auth/logout/", LogoutAPIView.as_view(), name="logout"),
    path("me/", MeAPIView.as_view(), name="me"),
    path("me/profile/", MeProfileAPIView.as_view(), name="me-profile"),
    path("me/profile/avatar/", MeProfileAvatarAPIView.as_view(), name="me-profile-avatar"),
    path("me/permissions/", MePermissionsAPIView.as_view(), name="me-permissions"),
    path("me/units/", MeUnitsAPIView.as_view(), name="me-units"),
]