from rest_framework.routers import DefaultRouter

from .views import SchoolUnitViewSet, CMSSchoolUnitViewSet


app_name = "units"

router = DefaultRouter()
router.register("cms/units", CMSSchoolUnitViewSet, basename="cms-unit")
router.register("units", SchoolUnitViewSet, basename="unit")

urlpatterns = router.urls