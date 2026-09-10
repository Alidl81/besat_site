from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.content.rich_text import render_tiptap_html, sanitize_stored_tiptap_document
from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import News, NewsCategory


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
    image = serializers.SerializerMethodField()
    content = serializers.CharField(source="content_text", read_only=True, allow_null=True)
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
            "image",
            "content",
            "published_at",
            "category",
            "scope",
            "unit",
            "status",
            "is_featured",
            "is_important",
            "priority",
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
        return obj.status == News.Status.PUBLISHED


class NewsDetailSerializer(NewsListSerializer):
    body_html = serializers.SerializerMethodField()
    body_json = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    def get_body_html(self, obj):
        return render_tiptap_html(obj.editor_json) if obj.editor_json else None

    def get_body_json(self, obj):
        return sanitize_stored_tiptap_document(obj.editor_json)

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_seo(self, obj):
        return obj.seo_fields_dict()

    class Meta(NewsListSerializer.Meta):
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "content_json",
            "body_html",
            "body_json",
            "cover_image",
            "published_at",
            "category",
            "scope",
            "unit",
            "status",
            "is_featured",
            "is_important",
            "priority",
            "is_published",
            "seo",
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
