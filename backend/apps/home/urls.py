from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CMSHomeSlideViewSet, HomePageAPIView


app_name = "home"

cms_router = DefaultRouter()
cms_router.register(
    "cms/home-slides",
    CMSHomeSlideViewSet,
    basename="cms-home-slide",
)

urlpatterns = [
    path("home/", HomePageAPIView.as_view(), name="home-page"),
]

urlpatterns += cms_router.urls