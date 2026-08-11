from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from ..models import (
    InPersonCourseDetail,
    OnlineCourseDetail,
    PhysicalProductDetail,
    Product,
    ProductImage,
    ShopCategory,
)
from ..permissions import MEDIA_MANAGER_WRITABLE_PRODUCT_FIELDS
from ..validators import validate_product_image_file


def raise_drf_validation_error(error: DjangoValidationError):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)
    raise serializers.ValidationError(error.messages)


def validate_image_or_error(value):
    try:
        validate_product_image_file(value)
    except DjangoValidationError as exc:
        raise_drf_validation_error(exc)
    return value


class CMSShopCategorySerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = ShopCategory
        fields = (
            "id", "title", "slug", "description", "cover_image", "cover_image_url",
            "is_active", "order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.cover_image, obj.cover_image_url)

    def validate_cover_image(self, value):
        return validate_image_or_error(value)

    def create(self, validated_data):
        instance = ShopCategory(**validated_data)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for field_name, value in validated_data.items():
            setattr(instance, field_name, value)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        instance.save()
        return instance


class CMSProductImageSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "image", "image_url", "alt_text", "caption", "order")
        read_only_fields = ("id",)

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.image, obj.image_url)


class CMSProductImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField(write_only=True)
    alt_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    caption = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_image(self, value):
        return validate_image_or_error(value)


class PhysicalDetailCMSSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhysicalProductDetail
        fields = (
            "sku", "inventory_qty", "low_stock_threshold", "availability",
            "weight_grams", "length_mm", "width_mm", "height_mm",
            "requires_shipping", "max_purchase_quantity",
        )


class OnlineCourseDetailCMSSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnlineCourseDetail
        fields = (
            "instructor_name", "course_type", "duration_minutes", "capacity",
            "start_date", "prerequisites", "level", "enrollment_status",
            "access_duration_days", "access_destination_type", "access_destination_value",
        )


class InPersonCourseDetailCMSSerializer(serializers.ModelSerializer):
    class Meta:
        model = InPersonCourseDetail
        fields = (
            "instructor_name", "course_type", "duration_minutes", "capacity",
            "start_date", "prerequisites", "level", "enrollment_status",
            "unit", "location_detail", "schedule_text", "end_date",
            "registration_deadline", "requires_enrollment_confirmation",
        )


class CMSProductListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    featured_image = serializers.SerializerMethodField()
    category_title = serializers.CharField(source="category.title", read_only=True, allow_null=True)

    class Meta:
        model = Product
        fields = (
            "id", "product_type", "title", "slug", "category", "category_title",
            "featured_image", "price_amount", "sale_price_amount", "status",
            "is_active", "is_featured", "is_important", "published_at", "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_featured_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.featured_image, obj.featured_image_url)


class CMSProductDetailSerializer(CMSProductListSerializer):
    gallery_images = CMSProductImageSerializer(many=True, read_only=True)
    physical_detail = serializers.SerializerMethodField()
    course_detail = serializers.SerializerMethodField()
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)
    published_by = serializers.StringRelatedField(read_only=True)
    seo = serializers.SerializerMethodField()

    class Meta(CMSProductListSerializer.Meta):
        fields = CMSProductListSerializer.Meta.fields + (
            "short_description", "description", "tags", "gallery_images",
            "physical_detail", "course_detail", "created_by", "updated_by",
            "published_by", "created_at", "seo",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_physical_detail(self, obj):
        detail = getattr(obj, "physical_detail", None)
        return PhysicalDetailCMSSerializer(detail).data if detail else None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_course_detail(self, obj):
        if obj.product_type == Product.ProductType.ONLINE_COURSE:
            detail = getattr(obj, "online_course_detail", None)
            return OnlineCourseDetailCMSSerializer(detail).data if detail else None
        if obj.product_type == Product.ProductType.IN_PERSON_COURSE:
            detail = getattr(obj, "in_person_course_detail", None)
            return InPersonCourseDetailCMSSerializer(detail).data if detail else None
        return None

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_seo(self, obj):
        return obj.seo_fields_dict()


class CMSProductWriteSerializer(serializers.Serializer):
    """Handles both create and update for all three product types. Field-
    level role gating (media manager vs admin) is enforced by the
    viewset's `_ensure_allowed_fields`, not here -- this serializer only
    validates shape/values, mirroring this repo's existing
    `_ensure_user_can_write_payload` split-of-concerns pattern in
    apps.news.views."""

    product_type = serializers.ChoiceField(choices=Product.ProductType.choices, required=False)
    title = serializers.CharField(required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=ShopCategory.objects.all(), required=False, allow_null=True
    )
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    short_description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    featured_image = serializers.ImageField(required=False, allow_null=True)
    featured_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_featured = serializers.BooleanField(required=False)
    is_important = serializers.BooleanField(required=False)
    price_amount = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    sale_price_amount = serializers.IntegerField(required=False, allow_null=True, min_value=0)

    focus_keyphrase = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    seo_title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    meta_description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    canonical_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    og_title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    og_description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    og_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_indexable = serializers.BooleanField(required=False)
    is_followable = serializers.BooleanField(required=False)
    is_cornerstone = serializers.BooleanField(required=False)

    physical_detail = PhysicalDetailCMSSerializer(required=False)
    course_detail = serializers.DictField(required=False)

    def validate_featured_image(self, value):
        return validate_image_or_error(value) if value else value

    def create(self, validated_data):
        # validated_data may also carry extra kwargs the view passed to
        # .save() (created_by/updated_by) -- those are valid Product
        # constructor kwargs too, so no extra filtering is needed here
        # beyond popping the two non-Product sub-payloads.
        physical_data = validated_data.pop("physical_detail", None)
        course_data = validated_data.pop("course_detail", None)

        product = Product(**validated_data)
        try:
            product.full_clean(validate_unique=False, validate_constraints=False)
            if not product.slug:
                product.slug = product._generate_unique_slug()
            product.full_clean(validate_unique=True, validate_constraints=True)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        product.save()

        self._save_detail(product, physical_data, course_data)
        return product

    def update(self, instance, validated_data):
        physical_data = validated_data.pop("physical_detail", None)
        course_data = validated_data.pop("course_detail", None)

        for field_name, value in validated_data.items():
            setattr(instance, field_name, value)
        try:
            instance.full_clean(validate_unique=True, validate_constraints=True)
        except DjangoValidationError as exc:
            raise_drf_validation_error(exc)
        instance.save()

        self._save_detail(instance, physical_data, course_data)
        return instance

    def _save_detail(self, product, physical_data, course_data):
        if product.product_type == Product.ProductType.PHYSICAL and physical_data:
            detail, _ = PhysicalProductDetail.objects.get_or_create(product=product)
            for field_name, value in physical_data.items():
                setattr(detail, field_name, value)
            try:
                detail.full_clean()
            except DjangoValidationError as exc:
                raise_drf_validation_error(exc)
            detail.save()

        elif product.product_type == Product.ProductType.ONLINE_COURSE and course_data:
            detail, _ = OnlineCourseDetail.objects.get_or_create(product=product)
            serializer = OnlineCourseDetailCMSSerializer(detail, data=course_data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        elif product.product_type == Product.ProductType.IN_PERSON_COURSE and course_data:
            detail, _ = InPersonCourseDetail.objects.get_or_create(product=product)
            serializer = InPersonCourseDetailCMSSerializer(detail, data=course_data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()


class ProductWorkflowActionSerializer(serializers.Serializer):
    published_at = serializers.DateField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
