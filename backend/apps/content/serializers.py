from rest_framework import serializers


class ContentAggregateQuerySerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=(
            "all",
            "news",
            "announcement",
            "event",
            "gallery",
        ),
        required=False,
        default="all",
    )
    scope = serializers.ChoiceField(
        choices=(
            "school",
            "unit",
        ),
        required=False,
    )
    unit_id = serializers.IntegerField(
        required=False,
        min_value=1,
    )
    status = serializers.CharField(
        required=False,
        default="published",
    )
    category = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    search = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    featured = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    ordering = serializers.ChoiceField(
        choices=(
            "published_at",
            "-published_at",
            "title",
            "-title",
        ),
        required=False,
        default="-published_at",
    )

    def validate_featured(self, value):
        if value is None:
            return None

        value = str(value).strip().lower()

        if value == "":
            return None

        if value in ("true", "1", "yes"):
            return True

        if value in ("false", "0", "no"):
            return False

        raise serializers.ValidationError(
            "featured باید یکی از مقادیر true, false, 1, 0, yes, no باشد."
        )


class ContentUnitSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()


class ContentCategorySerializer(serializers.Serializer):
    title = serializers.CharField()
    slug = serializers.CharField()


class ContentAggregateItemSerializer(serializers.Serializer):
    type = serializers.CharField()
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    summary = serializers.CharField(allow_null=True)
    cover_image = serializers.URLField(allow_null=True)
    published_at = serializers.DateField()
    category = ContentCategorySerializer(allow_null=True)
    scope = serializers.CharField()
    unit_id = serializers.IntegerField(allow_null=True)
    unit = ContentUnitSerializer(allow_null=True)
    status = serializers.CharField()
    is_featured = serializers.BooleanField()
    detail_url = serializers.CharField()
