from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin
from apps.units.models import SchoolUnit

from .. import money
from ..models import (
    InPersonCourseDetail,
    OnlineCourseDetail,
    PhysicalProductDetail,
    Product,
    ProductImage,
    ProductVariant,
    ShopCategory,
)


class UnitBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolUnit
        fields = ("id", "title", "slug")
        read_only_fields = fields


class ShopCategoryBriefSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    class Meta:
        model = ShopCategory
        fields = ("id", "title", "slug")
        read_only_fields = fields


class ShopCategoryListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = ShopCategory
        fields = ("id", "title", "slug", "description", "cover_image")
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_cover_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.cover_image, obj.cover_image_url)


class ProductImageSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "image", "alt_text", "caption", "order")
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.image, obj.image_url)


class ProductVariantSerializer(serializers.ModelSerializer):
    price_amount = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ("id", "sku", "title", "price_amount", "price_display", "attributes", "in_stock")
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.INT)
    def get_price_amount(self, obj) -> int:
        return obj.price_override_amount or obj.product.price_amount

    @extend_schema_field(OpenApiTypes.STR)
    def get_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(self.get_price_amount(obj))

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_in_stock(self, obj) -> bool:
        return obj.inventory_qty > 0


class PhysicalDetailPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhysicalProductDetail
        fields = (
            "availability",
            "weight_grams",
            "requires_shipping",
            "max_purchase_quantity",
        )
        read_only_fields = fields


class CourseDetailPublicSerializer(serializers.ModelSerializer):
    seats_left = serializers.SerializerMethodField()

    class Meta:
        fields = (
            "instructor_name",
            "course_type",
            "duration_minutes",
            "capacity",
            "seats_left",
            "start_date",
            "prerequisites",
            "level",
            "enrollment_status",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.INT)
    def get_seats_left(self, obj) -> int | None:
        if obj.capacity is None:
            return None
        return max(obj.capacity - obj.enrolled_count, 0)


class OnlineCourseDetailPublicSerializer(CourseDetailPublicSerializer):
    class Meta(CourseDetailPublicSerializer.Meta):
        model = OnlineCourseDetail
        fields = CourseDetailPublicSerializer.Meta.fields + ("access_duration_days",)
        read_only_fields = fields
        # access_destination_value is intentionally never exposed here --
        # it only reaches the buyer via CourseEnrollment after payment.


class InPersonCourseDetailPublicSerializer(CourseDetailPublicSerializer):
    unit = UnitBriefSerializer(read_only=True)

    class Meta(CourseDetailPublicSerializer.Meta):
        model = InPersonCourseDetail
        fields = CourseDetailPublicSerializer.Meta.fields + (
            "unit",
            "location_detail",
            "schedule_text",
            "end_date",
            "registration_deadline",
        )
        read_only_fields = fields


class ProductListSerializer(AbsoluteMediaURLMixin, serializers.ModelSerializer):
    category = ShopCategoryBriefSerializer(read_only=True)
    featured_image = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()
    sale_price_display = serializers.SerializerMethodField()
    is_on_sale = serializers.SerializerMethodField()
    is_published = serializers.SerializerMethodField()
    physical_detail = serializers.SerializerMethodField()
    course_detail = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "product_type",
            "title",
            "slug",
            "short_description",
            "featured_image",
            "category",
            "tags",
            "price_amount",
            "sale_price_amount",
            "price_display",
            "sale_price_display",
            "is_on_sale",
            "is_featured",
            "is_important",
            "status",
            "is_published",
            "physical_detail",
            "course_detail",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.URI)
    def get_featured_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.featured_image, obj.featured_image_url)

    @extend_schema_field(OpenApiTypes.STR)
    def get_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.price_amount)

    @extend_schema_field(OpenApiTypes.STR)
    def get_sale_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.sale_price_amount)

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_on_sale(self, obj) -> bool:
        return obj.sale_price_amount is not None

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_published(self, obj) -> bool:
        return obj.is_published

    @extend_schema_field(PhysicalDetailPublicSerializer)
    def get_physical_detail(self, obj):
        detail = getattr(obj, "physical_detail", None)
        if detail is None:
            return None
        return PhysicalDetailPublicSerializer(detail).data

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_course_detail(self, obj):
        if obj.product_type == Product.ProductType.ONLINE_COURSE:
            detail = getattr(obj, "online_course_detail", None)
            return OnlineCourseDetailPublicSerializer(detail).data if detail else None
        if obj.product_type == Product.ProductType.IN_PERSON_COURSE:
            detail = getattr(obj, "in_person_course_detail", None)
            return InPersonCourseDetailPublicSerializer(detail).data if detail else None
        return None


class ProductDetailSerializer(ProductListSerializer):
    gallery_images = ProductImageSerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "gallery_images",
            "variants",
            "seo",
        )
        read_only_fields = fields

    @extend_schema_field(ProductVariantSerializer(many=True))
    def get_variants(self, obj):
        if obj.product_type != Product.ProductType.PHYSICAL:
            return []
        return ProductVariantSerializer(
            obj.variants.filter(is_active=True).select_related("product"), many=True
        ).data

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_seo(self, obj):
        return obj.seo_fields_dict()
