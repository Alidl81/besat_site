from rest_framework import serializers

from ..models import CourseEnrollment


class MyCourseEnrollmentSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_type = serializers.CharField(source="product.product_type", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = (
            "id",
            "product_title",
            "product_slug",
            "product_type",
            "status",
            "is_confirmed",
            "access_url",
            "access_notes",
            "access_expires_at",
            "granted_at",
        )
        read_only_fields = fields
