from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementCategoryListAPIView,
    AnnouncementViewSet,
    CMSAnnouncementCategoryViewSet,
)


app_name = "announcements"

public_router = DefaultRouter()
public_router.register("announcements", AnnouncementViewSet, basename="announcement")

# Content authoring (create/update/publish/workflow) for announcements lives
# on the unified apps.content.cms.CMSContentViewSet ("cms/content/"), which
# the frontend actually calls. This router only keeps the category CRUD the
# frontend's category picker still uses -- the former "cms/announcements"
# article CRUD/workflow endpoints (CMSAnnouncementViewSet) were removed as
# unreachable dead code; see git history for the pre-removal implementation
# if ever needed.
cms_router = DefaultRouter()
cms_router.register(
    "cms/announcements/categories",
    CMSAnnouncementCategoryViewSet,
    basename="cms-announcement-category",
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