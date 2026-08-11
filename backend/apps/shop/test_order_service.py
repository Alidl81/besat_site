from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.shop.models import Order, OrderEvent
from apps.shop.services.order_service import (
    InvalidOrderTransition,
    record_order_event,
    transition_order_status,
)

User = get_user_model()


class OrderTransitionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="buyer", password="x")

    def make_order(self, **kwargs):
        return Order.objects.create(user=self.user, **kwargs)

    def test_valid_transition_updates_status_and_records_event(self):
        order = self.make_order(status=Order.Status.DRAFT)

        transition_order_status(order, Order.Status.PENDING_PAYMENT, reason="checkout submitted")

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        self.assertIsNotNone(order.placed_at)

        event = order.events.get(event_type=OrderEvent.EventType.STATUS_CHANGE)
        self.assertEqual(event.from_status, Order.Status.DRAFT)
        self.assertEqual(event.to_status, Order.Status.PENDING_PAYMENT)
        self.assertEqual(event.message, "checkout submitted")

    def test_invalid_transition_is_rejected(self):
        order = self.make_order(status=Order.Status.DRAFT)

        with self.assertRaises(InvalidOrderTransition):
            transition_order_status(order, Order.Status.PAID)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.DRAFT)
        self.assertFalse(order.events.exists())

    def test_terminal_status_has_no_outgoing_transitions(self):
        order = self.make_order(status=Order.Status.CANCELLED)

        with self.assertRaises(InvalidOrderTransition):
            transition_order_status(order, Order.Status.PENDING_PAYMENT)

    def test_paid_auto_advances_to_completed_when_no_shipping_required(self):
        order = self.make_order(status=Order.Status.PAYMENT_PROCESSING, requires_shipping=False)

        transition_order_status(order, Order.Status.PAID)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
        self.assertIsNotNone(order.paid_at)
        statuses = list(order.events.values_list("to_status", flat=True))
        self.assertIn(Order.Status.PAID, statuses)
        self.assertIn(Order.Status.COMPLETED, statuses)

    def test_paid_stays_paid_when_shipping_required(self):
        order = self.make_order(status=Order.Status.PAYMENT_PROCESSING, requires_shipping=True)

        transition_order_status(order, Order.Status.PAID)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)

    def test_record_order_event_does_not_change_status(self):
        order = self.make_order(status=Order.Status.PAID)

        record_order_event(
            order,
            OrderEvent.EventType.INVENTORY_CHANGE,
            message="stock decremented",
        )

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(order.events.count(), 1)
        self.assertEqual(order.events.first().event_type, OrderEvent.EventType.INVENTORY_CHANGE)
