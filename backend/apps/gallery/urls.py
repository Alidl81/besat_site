from rest_framework.routers import DefaultRouter

from .views import CMSGalleryItemViewSet, CMSMediaAssetViewSet, GalleryItemViewSet


app_name = "gallery"

public_router = DefaultRouter()
public_router.register("gallery", GalleryItemViewSet, basename="gallery")

cms_router = DefaultRouter()
cms_router.register("cms/gallery", CMSGalleryItemViewSet, basename="cms-gallery")
cms_router.register("cms/media", CMSMediaAssetViewSet, basename="cms-media")

urlpatterns = []

urlpatterns += public_router.urls
urlpatterns += cms_router.urls
