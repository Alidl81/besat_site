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
            "kind",
            "gender",
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
        if obj.cover_image:
            return self.build_absolute_media_url(obj.cover_image)
        return obj.cover_image_url

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_icon(self, obj):
        shared_unit_icon = self.context.get("shared_unit_icon")

        if not shared_unit_icon:
            return None

        return self.build_absolute_media_url(shared_unit_icon)


class SchoolUnitDetailSerializer(SchoolUnitListSerializer):
    pass



class CMSSchoolUnitSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
            "kind",
            "gender",
            "subtitle",
            "description",
            "cover_image",
            "age_range",
            "grade_range",
            "is_active",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.cover_image:
            data["cover_image"] = self.build_absolute_media_url(instance.cover_image)
        else:
            data["cover_image"] = instance.cover_image_url

        return data

    def create(self, validated_data):
        cover_image = validated_data.pop("cover_image", None)

        if isinstance(cover_image, str):
            validated_data["cover_image_url"] = cover_image.strip() or None

        return super().create(validated_data)

    def update(self, instance, validated_data):
        cover_image = validated_data.pop("cover_image", serializers.empty)

        if cover_image is not serializers.empty:
            if isinstance(cover_image, str):
                instance.cover_image_url = cover_image.strip() or None
                if instance.cover_image_url:
                    instance.cover_image = None
            elif cover_image is None:
                instance.cover_image_url = None
                instance.cover_image = None

        return super().update(instance, validated_data)