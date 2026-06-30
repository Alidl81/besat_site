from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import HomeSlide
from .validators import validate_home_slide_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_home_slide_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class HomeSlideSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = HomeSlide
        fields = (
            "id",
            "title",
            "subtitle",
            "image",
            "alt_text",
            "href",
            "is_active",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.image)


class CMSHomeSlideSerializer(HomeSlideSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = HomeSlide
        fields = (
            "id",
            "title",
            "subtitle",
            "image",
            "alt_text",
            "href",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSHomeSlideWriteSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = HomeSlide
        fields = (
            "id",
            "title",
            "subtitle",
            "image",
            "alt_text",
            "href",
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

    def validate_image(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate(self, attrs):
        instance = self.instance

        is_active = attrs.get(
            "is_active",
            instance.is_active if instance else True,
        )
        image = attrs.get(
            "image",
            instance.image if instance else None,
        )

        if is_active and not image:
            raise serializers.ValidationError(
                {
                    "image": "برای فعال بودن اسلاید، تصویر الزامی است.",
                }
            )

        return attrs