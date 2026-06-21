from django.urls import path

from .views import healthy_check

app_name = "core"

urlpatterns = [
    path("health/", healthy_check, name="health-check"),
]
