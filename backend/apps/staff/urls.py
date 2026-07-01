from rest_framework.routers import DefaultRouter

from .views import CMSStaffMemberViewSet, StaffMemberViewSet


app_name = "staff"

public_router = DefaultRouter()
public_router.register("staff", StaffMemberViewSet, basename="staff")

cms_router = DefaultRouter()
cms_router.register("cms/staff", CMSStaffMemberViewSet, basename="cms-staff")

urlpatterns = []

urlpatterns += public_router.urls
urlpatterns += cms_router.urls