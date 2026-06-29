from rest_framework.routers import DefaultRouter

from .views import CMSGalleryItemViewSet, GalleryItemViewSet


app_name = "gallery"

public_router = DefaultRouter()
public_router.register("gallery", GalleryItemViewSet, basename="gallery")

cms_router = DefaultRouter()
cms_router.register("cms/gallery", CMSGalleryItemViewSet, basename="cms-gallery")

urlpatterns = []

urlpatterns += public_router.urls
urlpatterns += cms_router.urls