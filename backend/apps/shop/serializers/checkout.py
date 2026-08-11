from rest_framework import serializers


class CheckoutPreviewRequestSerializer(serializers.Serializer):
    shipping_method_id = serializers.IntegerField(required=False, allow_null=True)


class CheckoutItemPreviewSerializer(serializers.Serializer):
    cart_item_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    title = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price_amount = serializers.IntegerField()
    line_total_amount = serializers.IntegerField()
    issue = serializers.CharField(allow_null=True)


class CheckoutPreviewResponseSerializer(serializers.Serializer):
    items = CheckoutItemPreviewSerializer(many=True)
    subtotal_amount = serializers.IntegerField()
    shipping_amount = serializers.IntegerField()
    discount_amount = serializers.IntegerField()
    tax_amount = serializers.IntegerField()
    total_amount = serializers.IntegerField()
    requires_shipping = serializers.BooleanField()
    can_checkout = serializers.BooleanField()


class PlaceOrderRequestSerializer(serializers.Serializer):
    shipping_method_id = serializers.IntegerField(required=False, allow_null=True)
    address_id = serializers.IntegerField(required=False, allow_null=True)
    customer_note = serializers.CharField(required=False, allow_blank=True, allow_null=True, trim_whitespace=True)
