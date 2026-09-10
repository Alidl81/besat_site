from django.db import IntegrityError, transaction
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
    # Bound on the "clear other defaults, then insert/update" retry loop
    # below. Two concurrent racers (the original repro) only need 2
    # attempts to always converge, but that bound is tight: with N truly
    # simultaneous "set as default" requests for the same user and no
    # pre-existing default, each retry only guarantees the *next* attempt
    # sees one more prior racer's row, so exhausting the budget before
    # convergence becomes deterministic once N > attempts. A handful of
    # genuinely simultaneous requests from the same user is already a
    # generous assumption for real traffic; 5 gives headroom well beyond
    # that while keeping a hard, finite bound (never an unbounded/livelock
    # loop) so a pathological case still fails loudly instead of hanging.
    _MAX_DEFAULT_ADDRESS_ATTEMPTS = 5

    # Name of the partial UniqueConstraint on Address (see
    # backend/apps/shop/models/orders.py) that the retry loop below is
    # specifically absorbing IntegrityError for.
    _DEFAULT_ADDRESS_CONSTRAINT = "unique_default_address_per_user"

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

    @staticmethod
    def _clear_other_defaults(user, exclude_pk=None):
        """Must run inside the same atomic() block as the write that sets
        the new default. select_for_update() here locks any existing
        is_default=True row(s) for this user so a concurrent request doing
        the same thing serializes behind us instead of racing -- but if
        this is the user's *first* default address there is nothing yet to
        lock, so this alone can't stop two concurrent "first default"
        creates from both racing to insert. The DB-level partial unique
        constraint (unique_default_address_per_user) is the backstop for
        that case; create()/update() retry (bounded by
        _MAX_DEFAULT_ADDRESS_ATTEMPTS) on the resulting IntegrityError so
        the loser(s) of that race cleanly re-serialize instead of
        surfacing a raw 500.
        """
        qs = Address.objects.select_for_update().filter(user=user, is_default=True)
        if exclude_pk is not None:
            qs = qs.exclude(pk=exclude_pk)
        qs.update(is_default=False)

    @classmethod
    def _is_default_address_race(cls, exc):
        """True if `exc` is the IntegrityError raised by the
        unique_default_address_per_user partial unique constraint -- i.e.
        a genuine "lost the race to become the default" collision that the
        retry loops below exist to absorb -- as opposed to some other,
        unrelated IntegrityError that happens to occur inside the same
        try block and should propagate instead of being silently retried.

        Our driver is psycopg3, which surfaces the underlying Postgres
        UniqueViolation as `exc.__cause__` with the violated constraint's
        name on `.diag.constraint_name`. If that information isn't
        available for some reason (different driver/backend, wrapped
        exception, etc.) we fall back to treating any IntegrityError on
        this path as the race: today Address has no other constraint that
        can raise IntegrityError from create()/update(), so that fallback
        is safe, not just convenient.
        """
        constraint_name = getattr(getattr(exc.__cause__, "diag", None), "constraint_name", None)
        if constraint_name is None:
            return True
        return constraint_name == cls._DEFAULT_ADDRESS_CONSTRAINT

    def create(self, validated_data):
        user = self.context["request"].user
        wants_default = bool(validated_data.get("is_default"))
        attempts = self._MAX_DEFAULT_ADDRESS_ATTEMPTS if wants_default else 1
        for attempt in range(attempts):
            try:
                with transaction.atomic():
                    if wants_default:
                        self._clear_other_defaults(user)
                    return Address.objects.create(user=user, **validated_data)
            except IntegrityError as exc:
                if attempt == attempts - 1 or not self._is_default_address_race(exc):
                    raise
                # Lost the race to set the user's *first* default address:
                # the other request's row is now visible, so retrying will
                # lock and clear it and make this one the default instead.
                continue

    def update(self, instance, validated_data):
        wants_default = bool(validated_data.get("is_default"))
        attempts = self._MAX_DEFAULT_ADDRESS_ATTEMPTS if wants_default else 1
        for attempt in range(attempts):
            try:
                with transaction.atomic():
                    if wants_default:
                        self._clear_other_defaults(instance.user, exclude_pk=instance.pk)
                    for field_name, value in validated_data.items():
                        setattr(instance, field_name, value)
                    instance.full_clean()
                    instance.save()
                    return instance
            except IntegrityError as exc:
                if attempt == attempts - 1 or not self._is_default_address_race(exc):
                    raise
                continue


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
        # FE-SHOP-ORDER-PENDING-PAYMENT-RETRY-001: PaymentStartAPIView /
        # payment_service.start_payment() already accept PENDING_PAYMENT
        # as well as PAYMENT_FAILED (see start_payment()'s own status
        # check) -- PENDING_PAYMENT is exactly the state an order is left
        # in when a payment-start attempt fails before ever reaching the
        # provider (start_payment() is one atomic transaction, so a
        # failure there rolls back even the PaymentAttempt row with it).
        # This field previously only reported PAYMENT_FAILED, silently
        # telling any consumer that a legitimately retryable order could
        # not be retried.
        return obj.status in (Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_FAILED)


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
