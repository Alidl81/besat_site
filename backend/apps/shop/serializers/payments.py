from rest_framework import serializers


class PaymentStartResponseSerializer(serializers.Serializer):
    attempt_id = serializers.IntegerField()
    provider = serializers.CharField()
    redirect_url = serializers.CharField()


class PaymentCallbackResponseSerializer(serializers.Serializer):
    outcome = serializers.CharField()
    order_number = serializers.CharField(allow_null=True)
    order_status = serializers.CharField(allow_null=True)
