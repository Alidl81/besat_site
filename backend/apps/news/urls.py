from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CMSNewsCategoryViewSet, NewsCategoryListAPIView, NewsViewSet


app_name = "news"

public_router = DefaultRouter()
public_router.register("news", NewsViewSet, basename="news")

# Content authoring (create/update/publish/workflow) for news lives on the
# unified apps.content.cms.CMSContentViewSet ("cms/content/"), which the
# frontend actually calls. This router only keeps the category CRUD the
# frontend's category picker still uses -- the former "cms/news" article
# CRUD/workflow endpoints (CMSNewsViewSet) were removed as unreachable dead
# code; see git history for the pre-removal implementation if ever needed.
cms_router = DefaultRouter()
cms_router.register("cms/news/categories", CMSNewsCategoryViewSet, basename="cms-news-category")

urlpatterns = [
    path(
        "news/categories/",
        NewsCategoryListAPIView.as_view(),
        name="news-category-list",
    ),
]

urlpatterns += public_router.urls
urlpatterns += cms_router.urls