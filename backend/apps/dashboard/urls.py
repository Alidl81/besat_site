from django.urls import path
from rest_framework.routers import DefaultRouter

from .cms_views import (
    CMSClassViewSet,
    CMSInternalMessageViewSet,
    CMSProgramViewSet,
    CMSStudentViewSet,
)

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

router = DefaultRouter()
router.register("cms/students", CMSStudentViewSet, basename="cms-student")
router.register("cms/classes", CMSClassViewSet, basename="cms-class")
router.register("cms/programs", CMSProgramViewSet, basename="cms-program")
router.register("cms/internal-messages", CMSInternalMessageViewSet, basename="cms-internal-message")
urlpatterns += router.urls
