from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import News, NewsCategory



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
            "is_featured",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)
    

class NewsDetailSerializer(NewsCategoryListSerializer):
    class Meta(NewsListSerializer.Meta):
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "content",
            "cover_image",
            "published_at",
            "category",
            "is_featured",
        )
        read_only_fields = fields