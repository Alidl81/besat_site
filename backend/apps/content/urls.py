from django.urls import path

from .views import ContentAggregateAPIView


app_name = "content"

urlpatterns = [
    path("content/", ContentAggregateAPIView.as_view(), name="content-aggregate"),
]