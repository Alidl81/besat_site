from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics

from apps.accounts.permissions import IsAuthenticatedAndActiveProfile

from ..models import Address, CourseEnrollment
from ..serializers import AddressSerializer, MyCourseEnrollmentSerializer


@extend_schema_view(
    get=extend_schema(tags=["Shop"], summary="List my saved addresses"),
    post=extend_schema(tags=["Shop"], summary="Add a saved address"),
)
class AddressListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = AddressSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Address.objects.none()
        return Address.objects.filter(user=self.request.user)


@extend_schema_view(
    get=extend_schema(tags=["Shop"], summary="Retrieve one of my saved addresses"),
    patch=extend_schema(tags=["Shop"], summary="Update one of my saved addresses"),
    delete=extend_schema(tags=["Shop"], summary="Delete one of my saved addresses"),
)
class AddressDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = AddressSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Address.objects.none()
        # Same 404-not-403 ownership pattern as OrderDetailAPIView.
        return Address.objects.filter(user=self.request.user)


class MyCourseEnrollmentsAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedAndActiveProfile]
    serializer_class = MyCourseEnrollmentSerializer
    pagination_class = None

    @extend_schema(tags=["Shop"], summary="List my course enrollments (purchased courses)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CourseEnrollment.objects.none()
        return (
            CourseEnrollment.objects.filter(user=self.request.user)
            .select_related("product")
            .order_by("-granted_at")
        )
