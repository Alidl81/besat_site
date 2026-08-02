from urllib.parse import urlsplit

import nh3
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from djangocms_rest.serializers.plugins import GenericPluginSerializer

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import (
    AboutFounderItem,
    AboutFounders,
    AboutGallery,
    AboutGalleryItem,
    AboutGoalItem,
    AboutGoals,
    AboutHero,
    AboutHistory,
    AboutHistoryItem,
    AboutPage,
    AboutRichText,
    AboutValueItem,
    AboutValues,
    AboutVideo,
)


def _filter_absolute_http_urls(tag, attribute, value):
    if attribute not in {"href", "src"}:
        return value

    parsed = urlsplit(value)
    if parsed.scheme.lower() in {"http", "https"} and parsed.netloc:
        return value
    return None


class AbsoluteImageSerializerMixin:
    def build_image_url(self, image_field):
        if not image_field:
            return None

        try:
            url = image_field.url
        except (ValueError, AttributeError):
            return None

        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class AboutPageSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = AboutPage
        fields = (
            "title",
            "description",
            "image",
            "meta_description",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.image)


class AboutHistoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AboutHistoryItem
        fields = ("id", "year", "title", "description", "order")


class AboutFounderItemSerializer(AbsoluteImageSerializerMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = AboutFounderItem
        fields = ("id", "full_name", "role", "bio", "image", "image_alt", "order")

    def get_image(self, obj):
        return self.build_image_url(obj.image)


class AboutValueItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AboutValueItem
        fields = ("id", "title", "description", "icon", "order")


class AboutGoalItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AboutGoalItem
        fields = ("id", "title", "description", "order")


class AboutGalleryItemSerializer(AbsoluteImageSerializerMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = AboutGalleryItem
        fields = ("id", "image", "alt_text", "caption", "order")

    def get_image(self, obj):
        return self.build_image_url(obj.image)


class AboutHeroPluginSerializer(AbsoluteImageSerializerMixin, GenericPluginSerializer):
    background_image = serializers.SerializerMethodField()

    class Meta:
        model = AboutHero
        fields = (
            "id",
            "plugin_type",
            "parent_plugin_type",
            "eyebrow",
            "title",
            "subtitle",
            "background_image",
            "image_alt",
            "cta_label",
            "cta_url",
        )

    def get_background_image(self, obj):
        return self.build_image_url(obj.background_image)


class AboutRichTextPluginSerializer(GenericPluginSerializer):
    body_html = serializers.SerializerMethodField()

    class Meta:
        model = AboutRichText
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "body_html")

    def get_body_html(self, obj):
        return nh3.clean(
            obj.body_html or "",
            attribute_filter=_filter_absolute_http_urls,
            url_schemes={"http", "https"},
        )


class AboutHistoryPluginSerializer(GenericPluginSerializer):
    items = AboutHistoryItemSerializer(many=True, read_only=True)

    class Meta:
        model = AboutHistory
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "intro", "items")


class AboutFoundersPluginSerializer(GenericPluginSerializer):
    items = AboutFounderItemSerializer(many=True, read_only=True)

    class Meta:
        model = AboutFounders
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "intro", "items")


class AboutValuesPluginSerializer(GenericPluginSerializer):
    items = AboutValueItemSerializer(many=True, read_only=True)

    class Meta:
        model = AboutValues
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "intro", "items")


class AboutGoalsPluginSerializer(GenericPluginSerializer):
    items = AboutGoalItemSerializer(many=True, read_only=True)

    class Meta:
        model = AboutGoals
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "intro", "items")


class AboutGalleryPluginSerializer(GenericPluginSerializer):
    items = AboutGalleryItemSerializer(many=True, read_only=True)

    class Meta:
        model = AboutGallery
        fields = ("id", "plugin_type", "parent_plugin_type", "heading", "intro", "items")


class AboutVideoPluginSerializer(AbsoluteImageSerializerMixin, GenericPluginSerializer):
    poster = serializers.SerializerMethodField()

    class Meta:
        model = AboutVideo
        fields = (
            "id",
            "plugin_type",
            "parent_plugin_type",
            "heading",
            "video_url",
            "poster",
            "caption",
            "autoplay",
        )

    def get_poster(self, obj):
        return self.build_image_url(obj.poster)
