from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import AbsoluteMediaURLMixin

from .. import money
from ..models import CartItem
from ..services.cart_service import resolve_cart_item_issue
from ..services.pricing import effective_unit_price


class CartItemProductBriefSerializer(AbsoluteMediaURLMixin, serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    product_type = serializers.CharField()
    featured_image = serializers.SerializerMethodField()

    @extend_schema_field(OpenApiTypes.URI)
    def get_featured_image(self, obj) -> str | None:
        return self.build_file_or_fallback_url(obj.featured_image, obj.featured_image_url)


class CartItemSerializer(serializers.ModelSerializer):
    product = CartItemProductBriefSerializer(read_only=True)
    variant_title = serializers.CharField(source="variant.title", read_only=True, allow_null=True)
    unit_price_amount = serializers.SerializerMethodField()
    unit_price_display = serializers.SerializerMethodField()
    line_total_amount = serializers.SerializerMethodField()
    line_total_display = serializers.SerializerMethodField()
    issue = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = (
            "id",
            "product",
            "variant",
            "variant_title",
            "quantity",
            "unit_price_amount",
            "unit_price_display",
            "line_total_amount",
            "line_total_display",
            "issue",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.INT)
    def get_unit_price_amount(self, obj) -> int:
        return effective_unit_price(obj.product, obj.variant)

    @extend_schema_field(OpenApiTypes.STR)
    def get_unit_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(self.get_unit_price_amount(obj))

    @extend_schema_field(OpenApiTypes.INT)
    def get_line_total_amount(self, obj) -> int:
        return self.get_unit_price_amount(obj) * obj.quantity

    @extend_schema_field(OpenApiTypes.STR)
    def get_line_total_display(self, obj) -> str | None:
        return money.format_amount_for_display(self.get_line_total_amount(obj))

    @extend_schema_field(OpenApiTypes.STR)
    def get_issue(self, obj) -> str | None:
        return resolve_cart_item_issue(obj)


class CartSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    items = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    subtotal_amount = serializers.SerializerMethodField()
    subtotal_display = serializers.SerializerMethodField()
    requires_shipping = serializers.SerializerMethodField()
    has_blocking_issue = serializers.SerializerMethodField()

    def to_representation(self, cart):
        items = list(cart.items.select_related(
            "product", "product__physical_detail", "product__online_course_detail",
            "product__in_person_course_detail", "variant",
        ).all())
        self._items_cache = items
        return super().to_representation(cart)

    @extend_schema_field(CartItemSerializer(many=True))
    def get_items(self, cart):
        return CartItemSerializer(getattr(self, "_items_cache", []), many=True).data

    def get_item_count(self, cart) -> int:
        return sum(item.quantity for item in getattr(self, "_items_cache", []))

    def get_subtotal_amount(self, cart) -> int:
        return sum(
            effective_unit_price(item.product, item.variant) * item.quantity
            for item in getattr(self, "_items_cache", [])
        )

    def get_subtotal_display(self, cart) -> str | None:
        return money.format_amount_for_display(self.get_subtotal_amount(cart))

    def get_requires_shipping(self, cart) -> bool:
        for item in getattr(self, "_items_cache", []):
            if item.product.product_type == item.product.ProductType.PHYSICAL:
                detail = getattr(item.product, "physical_detail", None)
                if detail and detail.requires_shipping:
                    return True
        return False

    def get_has_blocking_issue(self, cart) -> bool:
        return any(resolve_cart_item_issue(item) for item in getattr(self, "_items_cache", []))


class AddCartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
