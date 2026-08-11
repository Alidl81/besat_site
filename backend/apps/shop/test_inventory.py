from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from .models import Order, StockReservation
from .services import cart_service, checkout_service
from .tests import make_physical_product

User = get_user_model()


class ExpireStockReservationsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="expiring_buyer", password="x")

    def _place_unpaid_order(self, product):
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        return checkout_service.place_order(cart, self.user)

    def _run_command(self):
        out = StringIO()
        call_command("expire_stock_reservations", stdout=out)
        return out.getvalue()

    def test_expired_reservation_is_released_and_orphaned_order_is_cancelled(self):
        product = make_physical_product()
        order = self._place_unpaid_order(product)
        StockReservation.objects.filter(order_item__order=order).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        self._run_command()

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        reservation = StockReservation.objects.get(order_item__order=order)
        self.assertEqual(reservation.status, StockReservation.Status.RELEASED)

    def test_non_expired_reservation_is_left_untouched(self):
        product = make_physical_product()
        order = self._place_unpaid_order(product)

        self._run_command()

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        reservation = StockReservation.objects.get(order_item__order=order)
        self.assertEqual(reservation.status, StockReservation.Status.ACTIVE)

    def test_expired_reservation_frees_stock_for_the_next_buyer(self):
        product = make_physical_product()
        product.physical_detail.inventory_qty = 1
        product.physical_detail.save()

        first_order = self._place_unpaid_order(product)
        StockReservation.objects.filter(order_item__order=first_order).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        self._run_command()

        second_buyer = User.objects.create_user(username="second_buyer", password="x")
        cart, _ = cart_service.get_or_create_active_cart(user=second_buyer)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)

        # Must succeed now that the first buyer's hold was released.
        second_order = checkout_service.place_order(cart, second_buyer)
        self.assertEqual(second_order.status, Order.Status.PENDING_PAYMENT)

    def test_expiry_does_not_cancel_an_order_with_successful_payment(self):
        from .services import payment_service

        product = make_physical_product()
        order = self._place_unpaid_order(product)
        attempt, intent = payment_service.start_payment(order, actor=self.user, return_url="https://example.test/")
        token = intent.redirect_url.split("token=")[1].split("&")[0]
        payment_service.handle_payment_callback(
            "mock", {"attempt_id": attempt.pk, "outcome": "success", "mock_token": token}
        )

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)

        self._run_command()  # must be a no-op for this order

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
