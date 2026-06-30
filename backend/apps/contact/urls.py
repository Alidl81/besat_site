from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CMSContactMessageViewSet,
    ContactInfoAPIView,
    ContactMessageCreateAPIView,
)


app_name = "contact"

cms_router = DefaultRouter()
cms_router.register("cms/messages", CMSContactMessageViewSet, basename="cms-message")

urlpatterns = [
    path("contact/", ContactInfoAPIView.as_view(), name="contact-info"),
    path("messages/", ContactMessageCreateAPIView.as_view(), name="contact-message-create"),
]

urlpatterns += cms_router.urls