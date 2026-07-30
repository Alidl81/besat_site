from rest_framework import serializers


class DashboardContextUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    role_display = serializers.CharField()
    avatar_url = serializers.URLField(allow_null=True)


class DashboardContextUnitSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class DashboardContextSerializer(serializers.Serializer):
    user = DashboardContextUserSerializer()
    academic_years = serializers.ListField(child=serializers.DictField())
    selected_academic_year_id = serializers.IntegerField(allow_null=True)
    units = DashboardContextUnitSerializer(many=True)
    selected_unit_id = serializers.IntegerField(allow_null=True)
    children = serializers.ListField(child=serializers.DictField())
    selected_child_id = serializers.IntegerField(allow_null=True)
    unread_notifications = serializers.IntegerField()
    unread_messages = serializers.IntegerField()
    current_date = serializers.DateTimeField()


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
