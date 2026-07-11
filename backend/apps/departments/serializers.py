from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin, FileOrURLField

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
        return self.build_file_or_fallback_url(obj.cover_image, obj.cover_image_url)


class DepartmentDetailSerializer(DepartmentListSerializer):
    pass


class CMSDepartmentSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = FileOrURLField(required=False, allow_null=True)

    class Meta:
        model = Department
        fields = (
            "id",
            "title",
            "slug",
            "short_description",
            "description",
            "cover_image",
            "is_active",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["cover_image"] = self.build_file_or_fallback_url(
            instance.cover_image,
            instance.cover_image_url,
        )
        return data

    def create(self, validated_data):
        cover_image = validated_data.pop("cover_image", None)
        if isinstance(cover_image, str):
            validated_data["cover_image_url"] = cover_image
        elif cover_image is not None:
            validated_data["cover_image"] = cover_image
        return super().create(validated_data)

    def update(self, instance, validated_data):
        cover_image = validated_data.pop("cover_image", serializers.empty)
        if cover_image is not serializers.empty:
            if isinstance(cover_image, str):
                instance.cover_image = None
                instance.cover_image_url = cover_image
            elif cover_image is None:
                instance.cover_image = None
                instance.cover_image_url = None
            else:
                instance.cover_image = cover_image
                instance.cover_image_url = None
        return super().update(instance, validated_data)
