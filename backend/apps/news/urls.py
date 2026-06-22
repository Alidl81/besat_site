from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CMSNewsCategoryViewSet, CMSNewsViewSet, NewsCategoryListAPIView, NewsViewSet


app_name = "news"

public_router = DefaultRouter()
public_router.register("news", NewsViewSet, basename="news")

cms_router = DefaultRouter()
cms_router.register("cms/news/categories", CMSNewsCategoryViewSet, basename="cms-news-category")
cms_router.register("cms/news", CMSNewsViewSet, basename="cms-news")

urlpatterns = [
    path(
        "news/categories/",
        NewsCategoryListAPIView.as_view(),
        name="news-category-list",
    ),
]

urlpatterns += public_router.urls
urlpatterns += cms_router.urls