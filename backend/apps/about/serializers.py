from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import AboutPage


class AboutPageSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = AboutPage
        fields = (
            "title",
            "description",
            "image",
            "meta_description",
            "history",
            "founders",
            "key_people",
            "mission",
            "values",
            "goals",
            "images",
            "video_url",
            "video_poster_url",
            "video_title",
            "video_description",
            "video_caption",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.image)
