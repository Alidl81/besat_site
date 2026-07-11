from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import Announcement, AnnouncementCategory, AnnouncementMedia
from .utils import extract_editorjs_plain_text, validate_editorjs_content
from .validators import validate_announcement_image_file



def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_announcement_image_file(value)
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


class AnnouncementCategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementCategory
        fields = (
            "title",
            "slug",
        )
        read_only_fields = fields


class AnnouncementCategoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementCategory
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class AnnouncementListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    content = serializers.CharField(source="content_text", read_only=True, allow_null=True)
    category = AnnouncementCategoryBriefSerializer(read_only=True)
    unit = UnitBriefSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "cover_image",
            "image",
            "content",
            "published_at",
            "category",
            "scope",
            "unit",
            "status",
            "is_featured",
            "is_published",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.cover_image, obj.cover_image_url)

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.get_cover_image(obj)

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_published(self, obj) -> bool:
        return obj.status == Announcement.Status.PUBLISHED


class AnnouncementDetailSerializer(AnnouncementListSerializer):
    class Meta(AnnouncementListSerializer.Meta):
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "content_json",
            "cover_image",
            "published_at",
            "category",
            "scope",
            "unit",
            "status",
            "is_featured",
            "is_published",
        )
        read_only_fields = fields


class CMSAnnouncementCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementCategory
        fields = (
            "id",
            "title",
            "slug",
            "order",
            "is_active",
        )
        read_only_fields = (
            "id",
        )


class AnnouncementMediaSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    uploaded_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = AnnouncementMedia
        fields = (
            "id",
            "image",
            "alt_text",
            "caption",
            "uploaded_by",
            "created_at",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.image)


class CMSAnnouncementListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    category = AnnouncementCategoryBriefSerializer(read_only=True)
    unit = UnitBriefSerializer(read_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "summary",
            "cover_image",
            "scope",
            "unit",
            "status",
            "published_at",
            "is_featured",
            "is_active",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.cover_image, obj.cover_image_url)


class CMSAnnouncementDetailSerializer(CMSAnnouncementListSerializer):
    media_items = AnnouncementMediaSerializer(many=True, read_only=True)

    class Meta(CMSAnnouncementListSerializer.Meta):
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "summary",
            "cover_image",
            "content_json",
            "content_text",
            "scope",
            "unit",
            "status",
            "published_at",
            "is_featured",
            "is_active",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
            "media_items",
        )
        read_only_fields = fields


class CMSAnnouncementWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=AnnouncementCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    cover_image = serializers.ImageField(
        required=False,
        allow_null=True,
    )
    content_json = serializers.JSONField(
        required=False,
    )

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "summary",
            "cover_image",
            "content_json",
            "content_text",
            "scope",
            "unit",
            "status",
            "published_at",
            "is_featured",
            "is_active",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "content_text",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )

    def validate_cover_image(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate_content_json(self, value):
        try:
            return validate_editorjs_content(value)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

    def validate(self, attrs):
        instance = self.instance

        scope = attrs.get(
            "scope",
            instance.scope if instance else Announcement.Scope.SCHOOL,
        )
        unit = attrs.get(
            "unit",
            instance.unit if instance else None,
        )
        status = attrs.get(
            "status",
            instance.status if instance else Announcement.Status.DRAFT,
        )
        published_at = attrs.get(
            "published_at",
            instance.published_at if instance else None,
        )
        summary = attrs.get(
            "summary",
            instance.summary if instance else None,
        )
        category = attrs.get(
            "category",
            instance.category if instance else None,
        )
        content_json = attrs.get(
            "content_json",
            instance.content_json if instance else None,
        )

        if content_json is None:
            content_json = {}

        try:
            content_json = validate_editorjs_content(content_json)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)

        content_text = extract_editorjs_plain_text(content_json)

        errors = {}

        if scope == Announcement.Scope.SCHOOL and unit is not None:
            errors["unit"] = "برای محتوای عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if scope == Announcement.Scope.UNIT and unit is None:
            errors["unit"] = "برای محتوای وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if status == Announcement.Status.PUBLISHED:
            if not published_at:
                errors["published_at"] = "برای انتشار اطلاعیه، تاریخ انتشار الزامی است."

            if not summary:
                errors["summary"] = "برای انتشار اطلاعیه، خلاصه اطلاعیه الزامی است."

            if not content_text:
                errors["content_json"] = "برای انتشار اطلاعیه، متن اطلاعیه الزامی است."

            if category and not category.is_active:
                errors["category"] = "اطلاعیه منتشرشده نباید در دسته‌بندی غیرفعال باشد."

            if unit and not unit.is_active:
                errors["unit"] = "اطلاعیه منتشرشده نباید به واحد غیرفعال وصل باشد."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["content_json"] = content_json

        return attrs


class AnnouncementMediaUploadSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)

    class Meta:
        model = AnnouncementMedia
        fields = (
            "image",
            "alt_text",
            "caption",
        )

    def validate_image(self, value):
        return validate_image_or_error(value)


class AnnouncementWorkflowActionSerializer(serializers.Serializer):
    published_at = serializers.DateField(
        required=False,
        allow_null=True,
    )
