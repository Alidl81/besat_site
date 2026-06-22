from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import SchoolUnit


class SchoolUnitListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()

    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
            "subtitle",
            "description",
            "cover_image",
            "icon",
            "age_range",
            "grade_range",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_cover_image(self, obj):
        return self.build_absolute_media_url(obj.cover_image)

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_icon(self, obj):
        shared_unit_icon = self.context.get("shared_unit_icon")

        if not shared_unit_icon:
            return None

        return self.build_absolute_media_url(shared_unit_icon)


class SchoolUnitDetailSerializer(SchoolUnitListSerializer):
    pass