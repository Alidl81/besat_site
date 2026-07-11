from django.urls import path
from rest_framework.routers import DefaultRouter

from .cms import CMSStaticPageViewSet
from .views import AboutPageAPIView


app_name = "about"

urlpatterns = [
    path("about/", AboutPageAPIView.as_view(), name="about-page"),
]

router = DefaultRouter()
router.register("cms/static-pages", CMSStaticPageViewSet, basename="cms-static-page")
urlpatterns += router.urls
