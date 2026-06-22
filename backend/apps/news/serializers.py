from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import News, NewsCategory, NewsMedia
from .utils import extract_editorjs_plain_text, validate_editorjs_content
from .validators import validate_news_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_news_image_file(value)
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


class NewsCategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsCategory
        fields = (
            "title",
            "slug",
        )
        read_only_fields = fields


class NewsCategoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsCategory
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class NewsListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    category = NewsCategoryBriefSerializer(read_only=True)
    unit = UnitBriefSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = (
            "id",
            "title",
            "slug",
            "summary",
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

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_published(self, obj) -> bool:
        return obj.status == News.Status.PUBLISHED


class NewsDetailSerializer(NewsListSerializer):
    class Meta(NewsListSerializer.Meta):
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


class CMSNewsCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsCategory
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


class NewsMediaSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    uploaded_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = NewsMedia
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


class CMSNewsListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    category = NewsCategoryBriefSerializer(read_only=True)
    unit = UnitBriefSerializer(read_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = News
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
        return self.build_absolute_media_url(obj.cover_image)


class CMSNewsDetailSerializer(CMSNewsListSerializer):
    media_items = NewsMediaSerializer(many=True, read_only=True)

    class Meta(CMSNewsListSerializer.Meta):
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


class CMSNewsWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=NewsCategory.objects.all(),
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
        model = News
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
            instance.scope if instance else News.Scope.SCHOOL,
        )
        unit = attrs.get(
            "unit",
            instance.unit if instance else None,
        )
        status = attrs.get(
            "status",
            instance.status if instance else News.Status.DRAFT,
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

        if scope == News.Scope.SCHOOL and unit is not None:
            errors["unit"] = "برای محتوای عمومی مدرسه، واحد آموزشی باید خالی باشد."

        if scope == News.Scope.UNIT and unit is None:
            errors["unit"] = "برای محتوای وابسته به واحد، انتخاب واحد آموزشی الزامی است."

        if status == News.Status.PUBLISHED:
            if not published_at:
                errors["published_at"] = "برای انتشار خبر، تاریخ انتشار الزامی است."

            if not summary:
                errors["summary"] = "برای انتشار خبر، خلاصه خبر الزامی است."

            if not content_text:
                errors["content_json"] = "برای انتشار خبر، متن خبر الزامی است."

            if category and not category.is_active:
                errors["category"] = "خبر منتشرشده نباید در دسته‌بندی غیرفعال باشد."

            if unit and not unit.is_active:
                errors["unit"] = "خبر منتشرشده نباید به واحد غیرفعال وصل باشد."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["content_json"] = content_json

        return attrs


class NewsMediaUploadSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)

    class Meta:
        model = NewsMedia
        fields = (
            "image",
            "alt_text",
            "caption",
        )

    def validate_image(self, value):
        return validate_image_or_error(value)