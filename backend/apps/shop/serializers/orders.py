from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .. import money
from ..models import Address, Order, OrderItem, PaymentAttempt, ShippingMethod


class ShippingMethodSerializer(serializers.ModelSerializer):
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = ShippingMethod
        fields = ("id", "title", "description", "price_amount", "price_display", "is_default")
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.price_amount)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id",
            "recipient_full_name",
            "phone",
            "province",
            "city",
            "address_line1",
            "address_line2",
            "postal_code",
            "is_default",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        user = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=user, is_default=True).update(is_default=False)
        return Address.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Address.objects.filter(user=instance.user, is_default=True).exclude(pk=instance.pk).update(
                is_default=False
            )
        for field_name, value in validated_data.items():
            setattr(instance, field_name, value)
        instance.full_clean()
        instance.save()
        return instance


class OrderItemSerializer(serializers.ModelSerializer):
    unit_price_display = serializers.SerializerMethodField()
    line_total_display = serializers.SerializerMethodField()
    product_slug = serializers.CharField(source="product.slug", read_only=True, allow_null=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_slug",
            "product_type_snapshot",
            "title_snapshot",
            "sku_snapshot",
            "unit_price_amount_snapshot",
            "unit_price_display",
            "quantity",
            "line_total_amount",
            "line_total_display",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_unit_price_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.unit_price_amount_snapshot)

    @extend_schema_field(OpenApiTypes.STR)
    def get_line_total_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.line_total_amount)


class LatestPaymentAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAttempt
        fields = ("id", "provider", "status", "created_at")
        read_only_fields = fields


class OrderListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_display = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    can_retry_payment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "order_number",
            "status",
            "status_display",
            "total_amount",
            "total_display",
            "requires_shipping",
            "item_count",
            "can_retry_payment",
            "created_at",
            "paid_at",
        )
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_total_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.total_amount)

    @extend_schema_field(OpenApiTypes.INT)
    def get_item_count(self, obj) -> int:
        return sum(item.quantity for item in obj.items.all())

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_can_retry_payment(self, obj) -> bool:
        return obj.status == Order.Status.PAYMENT_FAILED


class OrderDetailSerializer(OrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    latest_payment_attempt = serializers.SerializerMethodField()

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + (
            "subtotal_amount",
            "shipping_amount",
            "discount_amount",
            "tax_amount",
            "shipping_recipient_name",
            "shipping_phone",
            "shipping_province",
            "shipping_city",
            "shipping_address_line1",
            "shipping_address_line2",
            "shipping_postal_code",
            "customer_note",
            "items",
            "latest_payment_attempt",
        )
        read_only_fields = fields

    @extend_schema_field(LatestPaymentAttemptSerializer)
    def get_latest_payment_attempt(self, obj):
        attempt = obj.payment_attempts.order_by("-created_at").first()
        return LatestPaymentAttemptSerializer(attempt).data if attempt else None
