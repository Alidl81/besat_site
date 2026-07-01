from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .models import Event
from .validators import validate_event_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_event_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)

    return value


class EventUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = (
            "id",
            "title",
            "slug",
        )
        read_only_fields = fields


class EventListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    unit = EventUnitSerializer(read_only=True)
    unit_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Event
        fields = (
            "id",
            "type",
            "title",
            "slug",
            "summary",
            "cover_image",
            "image",
            "alt_text",
            "location",
            "event_start_at",
            "event_end_at",
            "registration_url",
            "published_at",
            "scope",
            "unit",
            "unit_id",
            "is_featured",
        )
        read_only_fields = fields

    type = serializers.SerializerMethodField()

    def get_type(self, obj):
        return "event"

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.cover_image)


class EventDetailSerializer(EventListSerializer):
    class Meta(EventListSerializer.Meta):
        fields = EventListSerializer.Meta.fields + (
            "description",
        )
        read_only_fields = fields


class CMSEventListSerializer(EventListSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Event
        fields = EventListSerializer.Meta.fields + (
            "description",
            "status",
            "review_note",
            "is_active",
            "order",
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSEventDetailSerializer(CMSEventListSerializer):
    class Meta(CMSEventListSerializer.Meta):
        fields = CMSEventListSerializer.Meta.fields
        read_only_fields = fields


class CMSEventWriteSerializer(serializers.ModelSerializer):
    unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(),
        required=False,
        allow_null=True,
    )
    cover_image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Event
        fields = (
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "cover_image",
            "alt_text",
            "location",
            "event_start_at",
            "event_end_at",
            "registration_url",
            "published_at",
            "scope",
            "unit",
            "is_featured",
            "is_active",
            "order",
            "status",
            "review_note",
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

    def validate_cover_image(self, value):
        if value is None:
            return value

        return validate_image_or_error(value)

    def validate(self, attrs):
        scope = attrs.get(
            "scope",
            self.instance.scope if self.instance else Event.Scope.SCHOOL,
        )
        unit = attrs.get(
            "unit",
            self.instance.unit if self.instance else None,
        )
        status = attrs.get(
            "status",
            self.instance.status if self.instance else Event.Status.DRAFT,
        )
        published_at = attrs.get(
            "published_at",
            self.instance.published_at if self.instance else None,
        )

        if scope == Event.Scope.UNIT and not unit:
            raise serializers.ValidationError(
                {
                    "unit": "برای رویداد واحدی، انتخاب واحد الزامی است.",
                }
            )

        if scope == Event.Scope.SCHOOL and unit:
            raise serializers.ValidationError(
                {
                    "unit": "برای رویداد مدرسه‌ای نباید واحد انتخاب شود.",
                }
            )

        if unit and not unit.is_active:
            raise serializers.ValidationError(
                {
                    "unit": "واحد انتخاب‌شده فعال نیست.",
                }
            )

        if status == Event.Status.PUBLISHED and not published_at:
            raise serializers.ValidationError(
                {
                    "published_at": "برای انتشار رویداد، تاریخ انتشار الزامی است.",
                }
            )

        return attrs


class EventWorkflowActionSerializer(serializers.Serializer):
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
    )