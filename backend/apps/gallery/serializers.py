from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin, FileOrURLField
from apps.units.models import SchoolUnit

from .models import GalleryItem
from .permissions import get_accessible_unit_ids, is_general_manager
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
            "album",
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
        return self.build_file_or_fallback_url(obj.image, obj.media_url)

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
            "album",
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
    unit_id = serializers.PrimaryKeyRelatedField(
        source="unit",
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    image = FileOrURLField(
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
            "album",
            "alt_text",
            "caption",
            "event_date",
            "published_at",
            "scope",
            "unit",
            "unit_id",
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
        if value is None or isinstance(value, str):
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
        request = self.context.get("request")
        if (
            request
            and scope == GalleryItem.Scope.UNIT
            and unit is None
            and not is_general_manager(request.user)
        ):
            unit_ids = get_accessible_unit_ids(request.user)
            if len(unit_ids) == 1:
                unit = SchoolUnit.objects.get(pk=unit_ids[0])
                attrs["unit"] = unit
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
            (instance.image or instance.media_url) if instance else None,
        )

        errors = {}

        if scope == GalleryItem.Scope.SCHOOL and unit is not None:
            errors["unit"] = "برای گالری عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if scope == GalleryItem.Scope.UNIT and unit is None:
            errors["unit"] = "برای گالری وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if status == GalleryItem.Status.PUBLISHED:
            if not published_at:
                attrs["published_at"] = timezone.localdate()

            if not summary:
                attrs["summary"] = attrs.get("title", instance.title if instance else "")

            if not image:
                errors["image"] = "برای انتشار تصویر، فایل تصویر الزامی است."

            if unit and not unit.is_active:
                errors["unit"] = "تصویر منتشرشده نباید به واحد غیرفعال وصل باشد."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        image = validated_data.pop("image", None)
        if isinstance(image, str):
            validated_data["media_url"] = image
        elif image is not None:
            validated_data["image"] = image
            validated_data["media_url"] = None
        return super().create(validated_data)

    def update(self, instance, validated_data):
        image = validated_data.pop("image", serializers.empty)
        if image is not serializers.empty:
            if isinstance(image, str):
                instance.image = None
                instance.media_url = image
            elif image is None:
                instance.image = None
                instance.media_url = None
            else:
                instance.image = image
                instance.media_url = None
        return super().update(instance, validated_data)


class GalleryWorkflowActionSerializer(serializers.Serializer):
    published_at = serializers.DateField(
        required=False,
        allow_null=True,
    )
