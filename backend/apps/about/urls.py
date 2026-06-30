from django.urls import path

from .views import AboutPageAPIView


app_name = "about"

urlpatterns = [
    path("about/", AboutPageAPIView.as_view(), name="about-page"),
]