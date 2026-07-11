from rest_framework.routers import DefaultRouter

from .views import CMSDepartmentViewSet, DepartmentViewSet


app_name = "departments"

router = DefaultRouter()
router.register("cms/departments", CMSDepartmentViewSet, basename="cms-department")
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = router.urls
