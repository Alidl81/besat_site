from rest_framework import serializers

from .. import money
from ..models import CourseEnrollment, Order, PaymentAttempt, PaymentTransaction
from .orders import OrderItemSerializer


class CMSOrderEventSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    event_type = serializers.CharField()
    from_status = serializers.CharField(allow_null=True)
    to_status = serializers.CharField(allow_null=True)
    actor = serializers.SerializerMethodField()
    message = serializers.CharField(allow_null=True)
    metadata = serializers.DictField()
    created_at = serializers.DateTimeField()

    def get_actor(self, obj) -> str | None:
        return str(obj.actor) if obj.actor_id else None


class CMSOrderListSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    total_display = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id", "order_number", "user", "user_display", "status", "total_amount",
            "total_display", "requires_shipping", "created_at", "paid_at",
        )
        read_only_fields = fields

    def get_user_display(self, obj) -> str:
        return str(obj.user)

    def get_total_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.total_amount)


class CMSOrderDetailSerializer(CMSOrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta(CMSOrderListSerializer.Meta):
        fields = CMSOrderListSerializer.Meta.fields + (
            "subtotal_amount", "shipping_amount", "discount_amount", "tax_amount",
            "shipping_method", "shipping_recipient_name", "shipping_phone",
            "shipping_province", "shipping_city", "shipping_address_line1",
            "shipping_address_line2", "shipping_postal_code",
            "customer_note", "admin_note", "cancelled_at", "refunded_at", "items",
        )
        read_only_fields = fields


class CMSOrderActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class CMSPaymentAttemptSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = PaymentAttempt
        fields = (
            "id", "order", "order_number", "provider", "status",
            "amount_amount", "amount_display", "currency_code",
            "provider_reference", "created_at",
        )
        read_only_fields = fields

    def get_amount_display(self, obj) -> str | None:
        return money.format_amount_for_display(obj.amount_amount)


class CMSPaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = (
            "id", "attempt", "transaction_type", "provider_reference",
            "verified_amount_amount", "verified_currency_code", "result", "created_at",
        )
        read_only_fields = fields


class CMSCourseEnrollmentSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    product_title = serializers.CharField(source="product.title", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = (
            "id", "user", "user_display", "product", "product_title", "status",
            "is_confirmed", "access_url", "access_notes", "access_expires_at",
            "granted_at", "granted_by", "revoked_at", "revoked_by",
        )
        read_only_fields = (
            "id", "user", "product", "granted_at", "granted_by", "revoked_at", "revoked_by",
        )

    def get_user_display(self, obj) -> str:
        return str(obj.user)
