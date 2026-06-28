from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementCategoryListAPIView,
    AnnouncementViewSet,
    CMSAnnouncementCategoryViewSet,
    CMSAnnouncementViewSet,
)


app_name = "announcements"

public_router = DefaultRouter()
public_router.register("announcements", AnnouncementViewSet, basename="announcement")

cms_router = DefaultRouter()
cms_router.register(
    "cms/announcements/categories",
    CMSAnnouncementCategoryViewSet,
    basename="cms-announcement-category",
)
cms_router.register(
    "cms/announcements",
    CMSAnnouncementViewSet,
    basename="cms-announcement",
)

urlpatterns = [
    path(
        "announcements/categories/",
        AnnouncementCategoryListAPIView.as_view(),
        name="announcement-category-list",
    ),
]

urlpatterns += public_router.urls
urlpatterns += cms_router.urls