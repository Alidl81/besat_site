from django.urls import path

from .views import (
    GeneralManagerDashboardAPIView,
    MediaDashboardAPIView,
    ParentsDashboardAPIView,
    UnitManagerDashboardAPIView,
)


app_name = "dashboard"

urlpatterns = [
    path(
        "dashboard/general-manager/",
        GeneralManagerDashboardAPIView.as_view(),
        name="general-manager-dashboard",
    ),
    path(
        "dashboard/unit-manager/",
        UnitManagerDashboardAPIView.as_view(),
        name="unit-manager-dashboard",
    ),
    path(
        "dashboard/media/",
        MediaDashboardAPIView.as_view(),
        name="media-dashboard",
    ),
    path(
        "dashboard/parents/",
        ParentsDashboardAPIView.as_view(),
        name="parents-dashboard",
    ),
]