from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import GalleryItem
from .validators import validate_gallery_image_file



def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_gallery_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class UnitBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class GalleryItemListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    unit = UnitBriefSerializer(read_only=True)
    unit_id = serializers.IntegerField(read_only=True)
    is_published = serializers.SerializerMethodField()

    class Meta:
        model = GalleryItem
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "image",
            "alt_text",
            "caption",
            "event_date",
            "published_at",
            "scope",
            "unit_id",
            "unit",
            "status",
            "is_featured",
            "is_published",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.image)

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_published(self, obj) -> bool:
        return obj.status == GalleryItem.Status.PUBLISHED


class GalleryItemDetailSerializer(GalleryItemListSerializer):
    class Meta(GalleryItemListSerializer.Meta):
        fields = GalleryItemListSerializer.Meta.fields
        read_only_fields = fields


class CMSGalleryItemListSerializer(GalleryItemListSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = GalleryItem
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "image",
            "alt_text",
            "caption",
            "event_date",
            "published_at",
            "scope",
            "unit_id",
            "unit",
            "status",
            "is_featured",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSGalleryItemDetailSerializer(CMSGalleryItemListSerializer):
    class Meta(CMSGalleryItemListSerializer.Meta):
        fields = CMSGalleryItemListSerializer.Meta.fields
        read_only_fields = fields


class CMSGalleryItemWriteSerializer(serializers.ModelSerializer):
    unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = GalleryItem
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "image",
            "alt_text",
            "caption",
            "event_date",
            "published_at",
            "scope",
            "unit",
            "status",
            "is_featured",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )

    def validate_image(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate(self, attrs):
        instance = self.instance

        scope = attrs.get(
            "scope",
            instance.scope if instance else GalleryItem.Scope.SCHOOL,
        )
        unit = attrs.get(
            "unit",
            instance.unit if instance else None,
        )
        status = attrs.get(
            "status",
            instance.status if instance else GalleryItem.Status.DRAFT,
        )
        published_at = attrs.get(
            "published_at",
            instance.published_at if instance else None,
        )
        summary = attrs.get(
            "summary",
            instance.summary if instance else None,
        )

        image = attrs.get(
            "image",
            instance.image if instance else None,
        )

        errors = {}

        if scope == GalleryItem.Scope.SCHOOL and unit is not None:
            errors["unit"] = "برای گالری عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if scope == GalleryItem.Scope.UNIT and unit is None:
            errors["unit"] = "برای گالری وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if status == GalleryItem.Status.PUBLISHED:
            if not published_at:
                errors["published_at"] = "برای انتشار تصویر، تاریخ انتشار الزامی است."

            if not summary:
                errors["summary"] = "برای انتشار تصویر، توضیح کوتاه الزامی است."

            if not image:
                errors["image"] = "برای انتشار تصویر، فایل تصویر الزامی است."

            if unit and not unit.is_active:
                errors["unit"] = "تصویر منتشرشده نباید به واحد غیرفعال وصل باشد."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class GalleryWorkflowActionSerializer(serializers.Serializer):
    published_at = serializers.DateField(
        required=False,
        allow_null=True,
    )