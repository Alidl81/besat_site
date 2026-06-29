from rest_framework import serializers


class DashboardCardSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    value = serializers.IntegerField()
    description = serializers.CharField(
        allow_null=True,
        required=False,
    )


class DashboardResponseSerializer(serializers.Serializer):
    role = serializers.CharField()
    scope = serializers.CharField()
    selected_unit = serializers.DictField(
        allow_null=True,
        required=False,
    )
    accessible_units = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    stats = serializers.DictField()
    cards = DashboardCardSerializer(many=True)
    content_status = serializers.DictField(
        required=False,
    )
    recent_activity = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    profile = serializers.DictField(
        required=False,
    )