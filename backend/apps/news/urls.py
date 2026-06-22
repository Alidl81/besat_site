from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import NewdCategoryListAPIView, NewsViewSet



app_name = "news"

router = DefaultRouter()
router.register("news"m NewsViewSet, basename="news")

urlpatterns = [
    path(
        "news/category",
        NewdCategoryListAPIView.as_view(),
        name="news-category-list",
    ),
]

urlpatterns += router.urls
