from rest_framework import serializers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field


class AbsoluteMediaURLMixin:
    """
    Helper mixin for returning absolute media URLs in serializers.
    """

    def build_absolute_media_url(self, file_field):
        if not file_field:
            return None
        
        try:
            url = file_field.url
        except ValueError:
            return None
        
        request = self.context.get("request") if hasattr(self, "context") else None


        if request is None:
            return url
        
        return request.build_absolute_uri(url)

    def build_file_or_fallback_url(self, file_field, fallback_url=None):
        """Return an uploaded file URL, falling back to a frontend-managed URL."""
        file_url = self.build_absolute_media_url(file_field)
        return file_url or fallback_url or None


@extend_schema_field(OpenApiTypes.STR)
class FileOrURLField(serializers.Field):
    """Accept either an uploaded file or a URL/path string.

    The current frontend sends JSON URL strings, while the documented API also
    supports multipart file uploads.  Keeping both inputs avoids forcing either
    client to use the other's transport.
    """

    def to_internal_value(self, data):
        if data is None:
            return None

        if isinstance(data, str):
            value = data.strip()
            return value or None

        if hasattr(data, "read") and hasattr(data, "name"):
            return data

        self.fail("invalid")

    def to_representation(self, value):
        if not value:
            return None

        if hasattr(value, "url"):
            try:
                url = value.url
            except (ValueError, AttributeError):
                return None
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request else url

        return str(value)

    default_error_messages = {
        "invalid": "مقدار باید فایل بارگذاری‌شده یا نشانی معتبر باشد.",
    }
