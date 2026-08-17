from rest_framework.routers import DefaultRouter

from .views import CMSTourHotspotViewSet, CMSTourSceneViewSet, TourSceneViewSet

app_name = "virtual_tour"

public_router = DefaultRouter()
public_router.register("virtual-tour/scenes", TourSceneViewSet, basename="tour-scene")

cms_router = DefaultRouter()
cms_router.register("cms/virtual-tour/scenes", CMSTourSceneViewSet, basename="cms-tour-scene")
cms_router.register("cms/virtual-tour/hotspots", CMSTourHotspotViewSet, basename="cms-tour-hotspot")

urlpatterns = []
urlpatterns += public_router.urls
urlpatterns += cms_router.urls
