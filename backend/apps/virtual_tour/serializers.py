from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin, FileOrURLField
from apps.departments.models import Department
from apps.units.models import SchoolUnit

from .models import TourHotspot, TourScene
from .permissions import get_accessible_unit_ids, is_general_manager
from .validators import validate_panorama_image_file, validate_thumbnail_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)
    raise serializers.ValidationError(error.messages)


class UnitBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = ("id", "title", "slug")
        read_only_fields = fields


class DepartmentBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "title", "slug")
        read_only_fields = fields


class TourHotspotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourHotspot
        fields = ("id", "scene", "target_scene", "yaw", "pitch", "label", "order")
        read_only_fields = ("id",)

    def validate(self, attrs):
        try:
            instance = TourHotspot(
                pk=self.instance.pk if self.instance else None,
                scene=attrs.get("scene", self.instance.scene if self.instance else None),
                target_scene=attrs.get(
                    "target_scene", self.instance.target_scene if self.instance else None
                ),
                yaw=attrs.get("yaw", 0),
                pitch=attrs.get("pitch", 0),
            )
            instance.clean()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        return attrs


class TourSceneListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    panorama = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    unit = UnitBriefSerializer(read_only=True)
    department = DepartmentBriefSerializer(read_only=True)
    door_key = serializers.ReadOnlyField()
    is_published = serializers.SerializerMethodField()

    class Meta:
        model = TourScene
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "panorama",
            "thumbnail",
            "unit",
            "department",
            "door_key",
            "initial_yaw",
            "initial_pitch",
            "initial_hfov",
            "is_default",
            "status",
            "is_published",
            "is_active",
            "order",
        )
        read_only_fields = fields

    def get_panorama(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.panorama)

    def get_thumbnail(self, obj) -> str | None:
        return self.build_absolute_media_url(obj.thumbnail)

    def get_is_published(self, obj) -> bool:
        return obj.status == TourScene.Status.PUBLISHED


class TourSceneDetailSerializer(TourSceneListSerializer):
    hotspots = TourHotspotSerializer(many=True, read_only=True)

    class Meta(TourSceneListSerializer.Meta):
        fields = TourSceneListSerializer.Meta.fields + ("hotspots",)
        read_only_fields = fields


class CMSTourSceneListSerializer(TourSceneListSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)

    class Meta(TourSceneListSerializer.Meta):
        fields = TourSceneListSerializer.Meta.fields + (
            "created_by",
            "updated_by",
            "published_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CMSTourSceneDetailSerializer(CMSTourSceneListSerializer):
    hotspots = TourHotspotSerializer(many=True, read_only=True)

    class Meta(CMSTourSceneListSerializer.Meta):
        fields = CMSTourSceneListSerializer.Meta.fields + ("hotspots",)
        read_only_fields = fields


class CMSTourSceneWriteSerializer(serializers.ModelSerializer):
    unit = serializers.PrimaryKeyRelatedField(
        queryset=SchoolUnit.objects.all(), required=False, allow_null=True
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    panorama = FileOrURLField(required=False, allow_null=True)
    thumbnail = FileOrURLField(required=False, allow_null=True)

    class Meta:
        model = TourScene
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "unit",
            "department",
            "panorama",
            "thumbnail",
            "initial_yaw",
            "initial_pitch",
            "initial_hfov",
            "is_default",
            "status",
            "is_active",
            "order",
            "published_at",
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

    def validate_panorama(self, value):
        if value is None or isinstance(value, str):
            return value
        try:
            validate_panorama_image_file(value)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        return value

    def validate_thumbnail(self, value):
        if value is None or isinstance(value, str):
            return value
        try:
            validate_thumbnail_image_file(value)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        return value

    def validate(self, attrs):
        instance = self.instance
        unit = attrs.get("unit", instance.unit if instance else None)
        department = attrs.get("department", instance.department if instance else None)
        status_value = attrs.get("status", instance.status if instance else TourScene.Status.DRAFT)

        errors = {}

        if bool(unit) == bool(department):
            errors["unit"] = "صحنه باید دقیقاً به یک واحد آموزشی یا یک دپارتمان وصل باشد."

        request = self.context.get("request")
        if request and unit is None and department is None and not is_general_manager(request.user):
            unit_ids = get_accessible_unit_ids(request.user)
            if len(unit_ids) == 1:
                attrs["unit"] = SchoolUnit.objects.get(pk=unit_ids[0])

        if status_value == TourScene.Status.PUBLISHED and not attrs.get("published_at"):
            attrs["published_at"] = timezone.localdate()

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        panorama = validated_data.pop("panorama", None)
        thumbnail = validated_data.pop("thumbnail", None)
        if isinstance(panorama, str):
            validated_data["panorama"] = None
        elif panorama is not None:
            validated_data["panorama"] = panorama
        if isinstance(thumbnail, str):
            validated_data["thumbnail"] = None
        elif thumbnail is not None:
            validated_data["thumbnail"] = thumbnail
        return super().create(validated_data)

    def update(self, instance, validated_data):
        for field in ("panorama", "thumbnail"):
            value = validated_data.pop(field, serializers.empty)
            if value is not serializers.empty and not isinstance(value, str):
                setattr(instance, field, value)
        return super().update(instance, validated_data)


class TourWorkflowActionSerializer(serializers.Serializer):
    published_at = serializers.DateField(required=False, allow_null=True)
