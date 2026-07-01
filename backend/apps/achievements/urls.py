from rest_framework.routers import DefaultRouter

from .views import AchievementViewSet, CMSAchievementViewSet


app_name = "achievements"

public_router = DefaultRouter()
public_router.register("achievements", AchievementViewSet, basename="achievement")

cms_router = DefaultRouter()
cms_router.register("cms/achievements", CMSAchievementViewSet, basename="cms-achievement")

urlpatterns = []

urlpatterns += public_router.urls
urlpatterns += cms_router.urls