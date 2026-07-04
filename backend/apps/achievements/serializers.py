from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import Achievement
from .validators import validate_achievement_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_achievement_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class AchievementUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class AchievementListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    related_unit = AchievementUnitSerializer(read_only=True)
    related_unit_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Achievement
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "cover_image",
            "image",
            "achievement_date",
            "related_unit",
            "related_unit_id",
            "is_featured",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)


class AchievementDetailSerializer(AchievementListSerializer):
    class Meta(AchievementListSerializer.Meta):
        fields = AchievementListSerializer.Meta.fields
        read_only_fields = fields


class CMSAchievementListSerializer(AchievementListSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Achievement
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "cover_image",
            "image",
            "achievement_date",
            "related_unit",
            "related_unit_id",
            "is_featured",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSAchievementDetailSerializer(CMSAchievementListSerializer):
    class Meta(CMSAchievementListSerializer.Meta):
        fields = CMSAchievementListSerializer.Meta.fields
        read_only_fields = fields


class CMSAchievementWriteSerializer(serializers.ModelSerializer):
    related_unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    cover_image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Achievement
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "cover_image",
            "achievement_date",
            "related_unit",
            "is_featured",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def validate_cover_image(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate(self, attrs):
        related_unit = attrs.get(
            "related_unit",
            self.instance.related_unit if self.instance else None,
        )
        is_active = attrs.get(
            "is_active",
            self.instance.is_active if self.instance else True,
        )

        if is_active and related_unit and not related_unit.is_active:
            raise serializers.ValidationError(
                {
                    "related_unit": "افتخار فعال نباید به واحد غیرفعال متصل باشد.",
                }
            )

        return attrs