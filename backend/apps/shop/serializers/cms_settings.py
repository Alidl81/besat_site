from rest_framework import serializers

from ..models import ShippingMethod, ShopSettings


class CMSShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = ("id", "title", "description", "price_amount", "is_default", "is_active", "order")
        read_only_fields = ("id",)


class CMSShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = (
            "reservation_hold_minutes", "low_stock_default_threshold", "mock_payment_enabled",
            "default_shipping_method", "terms_url", "refund_policy_url",
        )
