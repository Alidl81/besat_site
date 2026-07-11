from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CMSRegistrationRequestViewSet,
    RegistrationInfoAPIView,
    RegistrationRequestCreateAPIView,
)


app_name = "registration"

cms_router = DefaultRouter()
cms_router.register(
    "cms/registration-requests",
    CMSRegistrationRequestViewSet,
    basename="cms-registration-request",
)
cms_router.register(
    "cms/registrations",
    CMSRegistrationRequestViewSet,
    basename="cms-registration-frontend-alias",
)

urlpatterns = [
    path("registration/", RegistrationInfoAPIView.as_view(), name="registration-info"),
    path(
        "registration-requests/",
        RegistrationRequestCreateAPIView.as_view(),
        name="registration-request-create",
    ),
]

urlpatterns += cms_router.urls
