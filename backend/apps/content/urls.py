from django.urls import path
from rest_framework.routers import DefaultRouter

from .cms import CMSContentViewSet
from .views import ContentAggregateAPIView


app_name = "content"

urlpatterns = [
    path("content/", ContentAggregateAPIView.as_view(), name="content-aggregate"),
]

router = DefaultRouter()
router.register("cms/content", CMSContentViewSet, basename="cms-content")
urlpatterns += router.urls
