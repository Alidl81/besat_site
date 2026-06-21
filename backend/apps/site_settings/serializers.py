from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .models import SiteSettings


class SiteSettingsSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()
    favicon = serializers.SerializerMethodField()
    hero_image = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = (
            "school_name",
            "short_name",
            "slogan",
            "intro_text",
            "logo",
            "favicon",
            "hero_title",
            "hero_subtitle",
            "hero_image",
            "address",
            "phone_primary",
            "phone_secondary",
            "email",
            "working_hours",
            "instagram_url",
            "telegram_url",
            "eitaa_url",
            "founded_year",
            "students_count",
            "staff_count",
            "achievements_count",
            "units_count",
        )
        read_only_fields = fields

    def get_logo(self, obj):
        return self.build_absolute_media_url(obj.logo)
    
    def get_favicon(self, obj):
        return self.build_absolute_media_url(obj.favicon)
    
    def get_hero_image(self, obj):
        return self.build_absolute_media_url(obj.hero_image)
    
    @classmethod
    def empty_payload(cls):
        return {
            field_name: None for field_name in cls.Meta.fields
        }