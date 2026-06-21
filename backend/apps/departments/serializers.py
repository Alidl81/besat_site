from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import Department


class DepartmentListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    icon = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = (
            "id",
            "title",
            "slug",
            "short_description",
            "description",
            "icon",
            "cover_image",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_icon(self, obj):
        return self.build_absolute_media_url(obj.icon)

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_cover_image(self, obj):
        return self.build_absolute_media_url(obj.cover_image)


class DepartmentDetailSerializer(DepartmentListSerializer):
    pass