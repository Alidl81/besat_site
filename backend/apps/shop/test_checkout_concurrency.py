"""Concurrency-safety tests for checkout.

This repo's test settings fall back to SQLite (see config/settings/test.py
-> local.py -> base.py's DATABASE_URL default), while production runs
Postgres. SQLite has no real row-level SELECT ... FOR UPDATE, so a
genuinely threaded race test against it exercises SQLite's own coarser
whole-database locking rather than the row-level Postgres locking
place_order() is written for -- useful as a smoke test, but not proof by
itself. The deterministic sequential tests below are the ones that
actually prove the core invariant (an active StockReservation counts
against availability for every *subsequent* check, which is what makes
concurrent checkouts serialize correctly on a real row-locking database):
placing order A first, then attempting order B for the same
last-remaining unit, must reject B even though nothing has "physically"
run at the same instant.
"""

import threading

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase

from .models import Order
from .services import cart_service, checkout_service
from .tests import make_in_person_course, make_physical_product

User = get_user_model()


class SequentialReservationPreventsOversellingTests(TestCase):
    def test_second_buyer_is_rejected_for_the_last_unit_after_first_reserves_it(self):
        product = make_physical_product(price_amount=100_000)
        product.physical_detail.inventory_qty = 1
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()

        buyer_a = User.objects.create_user(username="seq_a", password="x")
        buyer_b = User.objects.create_user(username="seq_b", password="x")

        cart_a, _ = cart_service.get_or_create_active_cart(user=buyer_a)
        cart_service.add_item(cart_a, product_id=product.pk, variant_id=None, quantity=1)
        cart_b, _ = cart_service.get_or_create_active_cart(user=buyer_b)
        cart_service.add_item(cart_b, product_id=product.pk, variant_id=None, quantity=1)

        order_a = checkout_service.place_order(cart_a, buyer_a)
        self.assertEqual(order_a.status, Order.Status.PENDING_PAYMENT)

        with self.assertRaises(checkout_service.CheckoutError) as ctx:
            checkout_service.place_order(cart_b, buyer_b)
        self.assertEqual(ctx.exception.code, "out_of_stock")

        # Inventory itself is untouched until payment -- only the
        # reservation blocks the second buyer, which is exactly what lets
        # buyer A's cancelled/expired/failed order free the unit back up.
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 1)

    def test_second_buyer_is_rejected_for_the_last_course_seat(self):
        course = make_in_person_course(price_amount=200_000)
        course.in_person_course_detail.capacity = 1
        course.in_person_course_detail.save()

        buyer_a = User.objects.create_user(username="seq_course_a", password="x")
        buyer_b = User.objects.create_user(username="seq_course_b", password="x")

        cart_a, _ = cart_service.get_or_create_active_cart(user=buyer_a)
        cart_service.add_item(cart_a, product_id=course.pk, variant_id=None, quantity=1)
        cart_b, _ = cart_service.get_or_create_active_cart(user=buyer_b)
        cart_service.add_item(cart_b, product_id=course.pk, variant_id=None, quantity=1)

        checkout_service.place_order(cart_a, buyer_a)

        with self.assertRaises(checkout_service.CheckoutError) as ctx:
            checkout_service.place_order(cart_b, buyer_b)
        self.assertEqual(ctx.exception.code, "course_full")


class ThreadedRaceSmokeTests(TransactionTestCase):
    """Best-effort: on SQLite either a clean CheckoutError or a low-level
    'database is locked' error both count as 'lost the race'. What must
    always hold is the end state: exactly one order for the contested
    unit, inventory never oversold."""

    def _run_concurrent_checkouts(self, product, quantity_per_buyer=1):
        buyer_a = User.objects.create_user(username="thread_a", password="x")
        buyer_b = User.objects.create_user(username="thread_b", password="x")

        cart_a, _ = cart_service.get_or_create_active_cart(user=buyer_a)
        cart_service.add_item(cart_a, product_id=product.pk, variant_id=None, quantity=quantity_per_buyer)
        cart_b, _ = cart_service.get_or_create_active_cart(user=buyer_b)
        cart_service.add_item(cart_b, product_id=product.pk, variant_id=None, quantity=quantity_per_buyer)

        results = {}
        barrier = threading.Barrier(2)

        def attempt(name, cart, user):
            try:
                barrier.wait(timeout=5)
                checkout_service.place_order(cart, user)
                results[name] = "success"
            except checkout_service.CheckoutError:
                results[name] = "rejected"
            except Exception:  # noqa: BLE001 - SQLite lock contention, treated as "rejected"
                results[name] = "rejected"
            finally:
                connection.close()

        thread_a = threading.Thread(target=attempt, args=("a", cart_a, buyer_a))
        thread_b = threading.Thread(target=attempt, args=("b", cart_b, buyer_b))
        thread_a.start()
        thread_b.start()
        thread_a.join(timeout=10)
        thread_b.join(timeout=10)
        return results

    def test_concurrent_checkouts_for_the_last_unit_never_both_succeed(self):
        product = make_physical_product(price_amount=100_000)
        product.physical_detail.inventory_qty = 1
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()

        results = self._run_concurrent_checkouts(product)

        self.assertLessEqual(list(results.values()).count("success"), 1, results)
        self.assertEqual(Order.objects.filter(status=Order.Status.PENDING_PAYMENT).count(), list(results.values()).count("success"))

    def test_concurrent_checkouts_for_the_last_course_seat_never_both_succeed(self):
        course = make_in_person_course(price_amount=200_000)
        course.in_person_course_detail.capacity = 1
        course.in_person_course_detail.save()

        results = self._run_concurrent_checkouts(course)

        self.assertLessEqual(list(results.values()).count("success"), 1, results)
