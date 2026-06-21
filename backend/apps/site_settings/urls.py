from django.urls import path

from .views import SiteSettingsAPIView


app_name = "site_settings"

urlpatterns = [
    path("site-settings/", SiteSettingsAPIView.as_view(), name="site-settings"),
]
