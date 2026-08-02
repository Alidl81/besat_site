from django.urls import path
from rest_framework.routers import DefaultRouter

from .cms_views import (
    CMSClassViewSet,
    CMSInternalMessageViewSet,
    CMSProgramViewSet,
    CMSStudentViewSet,
)

from .views import (
    DashboardContextAPIView,
    GeneralManagerDashboardAPIView,
    MediaDashboardAPIView,
    ParentsDashboardAPIView,
    UnitManagerDashboardAPIView,
)
from .panel_views import (
    ParentChildDetailAPIView,
    ParentChildrenAPIView,
    ParentProgramsAPIView,
    ParentRegistrationsAPIView,
    PanelServicesAPIView,
    ReportsExportAPIView,
    ReportsOverviewAPIView,
)


app_name = "dashboard"

urlpatterns = [
    path("parents/children/", ParentChildrenAPIView.as_view(), name="parent-children"),
    path("parents/children/<int:pk>/", ParentChildDetailAPIView.as_view(), name="parent-child-detail"),
    path("parents/programs/", ParentProgramsAPIView.as_view(), name="parent-programs"),
    path("parents/registrations/", ParentRegistrationsAPIView.as_view(), name="parent-registrations"),
    path("cms/reports/overview/", ReportsOverviewAPIView.as_view(), name="cms-reports-overview"),
    path("cms/reports/export/", ReportsExportAPIView.as_view(), name="cms-reports-export"),
    path("cms/services/", PanelServicesAPIView.as_view(), name="cms-services"),
    path(
        "dashboard/context/",
        DashboardContextAPIView.as_view(),
        name="dashboard-context",
    ),
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
