from rest_framework.routers import DefaultRouter

from .views import CMSEventViewSet, EventViewSet


app_name = "events"

public_router = DefaultRouter()
public_router.register("events", EventViewSet, basename="event")

cms_router = DefaultRouter()
cms_router.register("cms/events", CMSEventViewSet, basename="cms-event")

urlpatterns = []

urlpatterns += public_router.urls
urlpatterns += cms_router.urls