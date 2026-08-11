from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CourseEnrollment, Order, PaymentAttempt, PaymentTransaction
from .services import cart_service, checkout_service
from .tests import make_online_course, make_physical_product

User = get_user_model()


def _extract_mock_token(redirect_url: str) -> str:
    return redirect_url.split("token=")[1].split("&")[0]


class PaymentFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="payer1", password="x")
        self.client.force_authenticate(self.user)

    def _place_physical_order(self, *, price=500_000, stock=5):
        product = make_physical_product(price_amount=price)
        # requires_shipping=False keeps this helper focused on the
        # payment flow under test -- shipping/address validation has its
        # own dedicated coverage in test_checkout.py.
        product.physical_detail.inventory_qty = stock
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        order = checkout_service.place_order(cart, self.user)
        return product, order

    def _place_course_order(self):
        course = make_online_course(price_amount=900_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=course.pk, variant_id=None, quantity=1)
        order = checkout_service.place_order(cart, self.user)
        return course, order

    def test_full_success_flow_decrements_stock_and_marks_order_paid(self):
        product, order = self._place_physical_order(stock=5)

        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        self.assertEqual(start_response.status_code, 200)
        token = _extract_mock_token(start_response.data["redirect_url"])
        attempt_id = start_response.data["attempt_id"]

        callback_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": attempt_id, "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(callback_response.status_code, 200)
        self.assertEqual(callback_response.data["outcome"], "success")

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)  # no shipping -> auto-completes...
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 4)

    def test_course_purchase_grants_entitlement_only_after_payment(self):
        course, order = self._place_course_order()

        self.assertFalse(CourseEnrollment.objects.filter(user=self.user, product=course).exists())

        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])

        self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )

        enrollment = CourseEnrollment.objects.get(user=self.user, product=course)
        self.assertEqual(enrollment.status, CourseEnrollment.Status.ACTIVE)
        self.assertTrue(enrollment.is_confirmed)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)

    def test_duplicate_callback_does_not_double_decrement_stock(self):
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])
        payload = {
            "attempt_id": start_response.data["attempt_id"],
            "outcome": "success",
            "mock_token": token,
        }

        first = self.client.post("/api/shop/payments/callback/mock/", payload, format="json")
        second = self.client.post("/api/shop/payments/callback/mock/", payload, format="json")

        self.assertEqual(first.data["outcome"], "success")
        self.assertEqual(second.data["outcome"], "duplicate")

        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 4)  # decremented exactly once

        attempt = PaymentAttempt.objects.get(pk=start_response.data["attempt_id"])
        self.assertEqual(
            attempt.transactions.filter(
                transaction_type=PaymentTransaction.TransactionType.VERIFICATION_SUCCEEDED
            ).count(),
            1,
        )
        self.assertEqual(
            attempt.transactions.filter(
                transaction_type=PaymentTransaction.TransactionType.DUPLICATE_CALLBACK_REJECTED
            ).count(),
            1,
        )

    def test_invalid_callback_token_is_rejected_and_does_not_mutate_order(self):
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )

        response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": "forged"},
            format="json",
        )

        self.assertEqual(response.data["outcome"], "failed")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 5)

    def test_amount_mismatch_is_rejected(self):
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])

        # Simulate the order's total having changed after the payment
        # attempt was created (e.g. data drift) -- the callback must
        # compare against the order's CURRENT total, not blindly accept.
        Order.objects.filter(pk=order.pk).update(total_amount=1)

        response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(response.data["outcome"], "amount_mismatch")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 5)

    def test_retry_after_failed_payment_creates_a_new_attempt(self):
        product, order = self._place_physical_order(stock=5)
        first_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": first_start.data["attempt_id"], "outcome": "failure", "mock_token": _extract_mock_token(first_start.data["redirect_url"])},
            format="json",
        )
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)

        second_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        self.assertEqual(second_start.status_code, 200)
        self.assertNotEqual(first_start.data["attempt_id"], second_start.data["attempt_id"])
        self.assertEqual(PaymentAttempt.objects.filter(order=order).count(), 2)

        token = _extract_mock_token(second_start.data["redirect_url"])
        callback = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": second_start.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )
        self.assertEqual(callback.data["outcome"], "success")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)

    def test_cannot_start_payment_for_another_users_order(self):
        _, order = self._place_physical_order()
        other_user = User.objects.create_user(username="other_payer", password="x")
        self.client.force_authenticate(other_user)

        response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )

        self.assertEqual(response.status_code, 404)
