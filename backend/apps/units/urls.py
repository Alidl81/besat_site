from rest_framework.routers import DefaultRouter

from .views import SchoolUnitViewSet


app_name = "units"

router = DefaultRouter()
router.register("units", SchoolUnitViewSet, basename="unit")

urlpatterns = router.urls