from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView ,SpectacularSwaggerView


admin.site.site_header = "پنل مدیریت سایت"
admin.site.site_title = "مدیریت سایت"
admin.site.index_title = "داشبورد مدیریت"


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.site_settings.urls")),
    path("api/", include("apps.units.urls")),
    path("api/", include("apps.departments.urls")),
    path("api/", include("apps.news.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, decument_root=settings.MEDIA_ROOT)
