from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIViewm ,SpectacularSwaggerView


admin.site.site_header = "پنل مدیریت سایت"
admin.site.site_title = "مدیریت سایت"
admin.site.index_title = "داشبورد مدیریت"


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/schema/", SpectacularAPIViewm.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, decument_root=settings.MEDIA_ROOT)
