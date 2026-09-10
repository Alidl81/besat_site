from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CourseEnrollment, Order, PaymentAttempt, PaymentTransaction, StockReservation
from .services import cart_service, checkout_service
from .tests import make_in_person_course, make_online_course, make_physical_product

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

    def _place_in_person_course_order(self):
        course = make_in_person_course(price_amount=1_200_000)
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

    def test_return_url_is_a_same_origin_relative_path_not_an_absolute_url(self):
        # The frontend's mock-payment-gateway page only follows a return_url
        # that starts with "/" (its anti-open-redirect allowlist rejects any
        # absolute URL, including our own trusted origin) -- so the backend
        # must hand it a relative path or every real checkout silently lands
        # back on /shop instead of the order confirmation page.
        _, order = self._place_physical_order()

        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )

        self.assertEqual(start_response.status_code, 200)
        query = parse_qs(urlsplit(start_response.data["redirect_url"]).query)
        return_url = query["return_url"][0]
        self.assertTrue(return_url.startswith("/"))
        self.assertEqual(return_url, f"/shop/orders/{order.order_number}/")

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

    def test_success_callback_after_a_prior_failure_on_the_same_attempt_is_rejected(self):
        # PAY-SAME-ATTEMPT-REVERSAL-001: a valid failure callback followed
        # by a later valid success for the SAME attempt used to sail
        # through -- only a prior SUCCESS was checked, never a prior
        # FAILURE -- consuming inventory/entitlements and leaving the
        # order stuck at PAYMENT_FAILED with a SUCCEEDED attempt
        # underneath it (a contradictory, inconsistent state).
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])
        attempt_id = start_response.data["attempt_id"]

        failure = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": attempt_id, "outcome": "failure", "mock_token": token},
            format="json",
        )
        self.assertEqual(failure.data["outcome"], "failed")

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)

        late_success = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": attempt_id, "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(late_success.data["outcome"], "duplicate")

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 5)  # untouched

        attempt = PaymentAttempt.objects.get(pk=attempt_id)
        self.assertEqual(attempt.status, PaymentAttempt.Status.FAILED)
        self.assertEqual(
            attempt.transactions.filter(
                transaction_type=PaymentTransaction.TransactionType.VERIFICATION_SUCCEEDED
            ).count(),
            0,
        )
        self.assertEqual(
            attempt.transactions.filter(
                transaction_type=PaymentTransaction.TransactionType.DUPLICATE_CALLBACK_REJECTED
            ).count(),
            1,
        )

    def test_success_callback_for_an_expired_current_attempt_is_rejected(self):
        # PAY-SAME-ATTEMPT-REVERSAL-001-R1: the terminal-guard tuple only
        # listed SUCCEEDED/FAILED (the two statuses the app's own code
        # currently ever assigns), so an attempt manually moved to EXPIRED
        # or CANCELLED (both legitimate terminal PaymentAttempt.Status
        # values) still had a later success callback sail straight
        # through, decrementing inventory and completing the order.
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])
        attempt_id = start_response.data["attempt_id"]

        attempt = PaymentAttempt.objects.get(pk=attempt_id)
        attempt.status = PaymentAttempt.Status.EXPIRED
        attempt.save(update_fields=["status"])

        late_success = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": attempt_id, "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(late_success.data["outcome"], "duplicate")
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 5)
        order.refresh_from_db()
        self.assertNotEqual(order.status, Order.Status.COMPLETED)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, PaymentAttempt.Status.EXPIRED)

    def test_success_callback_for_a_cancelled_current_attempt_is_rejected(self):
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])
        attempt_id = start_response.data["attempt_id"]

        attempt = PaymentAttempt.objects.get(pk=attempt_id)
        attempt.status = PaymentAttempt.Status.CANCELLED
        attempt.save(update_fields=["status"])

        late_success = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": attempt_id, "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(late_success.data["outcome"], "duplicate")
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 5)
        order.refresh_from_db()
        self.assertNotEqual(order.status, Order.Status.COMPLETED)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, PaymentAttempt.Status.CANCELLED)

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

    def test_callback_with_a_json_array_body_is_rejected_as_bad_request_not_a_500(self):
        # REL-PAYMENT-CALLBACK-INPUT-001: request_data.get("attempt_id")
        # deep inside handle_payment_callback used to raise an unhandled
        # AttributeError for any non-dict JSON body, surfacing as a 500 to
        # an anonymous caller instead of a bounded 4xx.
        response = self.client.post("/api/shop/payments/callback/mock/", [], format="json")
        self.assertEqual(response.status_code, 400)

    def test_callback_with_a_json_null_body_is_rejected_as_bad_request_not_a_500(self):
        # APIClient.post(..., None, format="json") sends an empty body, not
        # a literal JSON "null" -- send the raw bytes directly so this
        # actually exercises request.data being None, not {}.
        response = self.client.post(
            "/api/shop/payments/callback/mock/", data="null", content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_callback_for_an_unregistered_provider_is_a_404_not_a_500(self):
        # REL-PAYMENT-CALLBACK-INPUT-001: get_payment_provider() raises a
        # plain ValueError for a name outside the PROVIDERS registry, which
        # used to propagate uncaught out of handle_payment_callback.
        response = self.client.post(
            "/api/shop/payments/callback/not-a-real-gateway/", {"attempt_id": 1}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_get_callback_for_an_unregistered_provider_is_a_404_not_a_500(self):
        response = self.client.get("/api/shop/payments/callback/not-a-real-gateway/", {"attempt_id": 1})
        self.assertEqual(response.status_code, 404)

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

    # -- PAY-001: a late success callback must not apply inventory/entitlement
    # effects once the item's stock reservation is no longer active. --

    def test_late_success_after_reservation_expiry_does_not_double_apply_inventory(self):
        product, order = self._place_physical_order(stock=5)
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])

        # Simulate the reservation's hold expiring before the (real,
        # legitimate, single) payment callback finally arrives -- e.g. a
        # slow/delayed provider webhook. This is the exact mechanism
        # expire_stock_reservations uses in production.
        StockReservation.objects.filter(order_item__order=order).update(
            expires_at=timezone.now() - timezone.timedelta(minutes=1)
        )
        call_command("expire_stock_reservations")
        order.refresh_from_db()
        self.assertEqual(
            order.status,
            Order.Status.CANCELLED,
            "expire_stock_reservations should have cancelled the now-unreserved, unpaid order.",
        )

        callback_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )

        # The attempt itself really did succeed (real money moved) --
        # that's recorded for audit -- but it must not silently sell stock
        # that may already have gone to someone else.
        self.assertEqual(callback_response.data["outcome"], "success")
        product.physical_detail.refresh_from_db()
        self.assertEqual(
            product.physical_detail.inventory_qty,
            5,
            "Inventory was decremented for an order whose stock reservation had already expired/released.",
        )
        order.refresh_from_db()
        self.assertEqual(
            order.status,
            Order.Status.CANCELLED,
            "A late callback resurrected a cancelled order's status instead of leaving it for manual review.",
        )
        attempt = PaymentAttempt.objects.get(pk=start_response.data["attempt_id"])
        self.assertEqual(attempt.status, PaymentAttempt.Status.SUCCEEDED)

    def test_late_success_after_reservation_expiry_does_not_grant_online_course_access(self):
        course, order = self._place_course_order()
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])

        StockReservation.objects.filter(order_item__order=order).update(
            expires_at=timezone.now() - timezone.timedelta(minutes=1)
        )
        call_command("expire_stock_reservations")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

        callback_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(callback_response.data["outcome"], "success")
        self.assertFalse(
            CourseEnrollment.objects.filter(user=self.user, product=course).exists(),
            "A late payment callback granted course access after the seat reservation had already expired/released.",
        )

    def test_late_success_after_reservation_expiry_does_not_grant_in_person_course_access(self):
        course, order = self._place_in_person_course_order()
        start_response = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        token = _extract_mock_token(start_response.data["redirect_url"])

        StockReservation.objects.filter(order_item__order=order).update(
            expires_at=timezone.now() - timezone.timedelta(minutes=1)
        )
        call_command("expire_stock_reservations")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

        callback_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": start_response.data["attempt_id"], "outcome": "success", "mock_token": token},
            format="json",
        )

        self.assertEqual(callback_response.data["outcome"], "success")
        self.assertFalse(
            CourseEnrollment.objects.filter(user=self.user, product=course).exists(),
            "A late payment callback granted in-person course access after the seat reservation had already expired/released.",
        )

    # -- PAY-002: a stale callback for a superseded payment attempt must not
    # move the order's status; only the order's current/latest attempt may. --

    def test_stale_failure_from_a_superseded_attempt_does_not_reset_a_processing_order(self):
        product, order = self._place_physical_order(stock=5)
        first_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        first_token = _extract_mock_token(first_start.data["redirect_url"])
        self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": first_start.data["attempt_id"], "outcome": "failure", "mock_token": first_token},
            format="json",
        )
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_FAILED)

        second_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_PROCESSING)

        # The first attempt's failure callback arrives again, late (e.g. a
        # retried webhook delivery from the provider), after the retry
        # attempt has already started and the order has moved on.
        stale_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": first_start.data["attempt_id"], "outcome": "failure", "mock_token": first_token},
            format="json",
        )
        self.assertEqual(stale_response.data["outcome"], "failed")  # the ATTEMPT really did fail
        order.refresh_from_db()
        self.assertEqual(
            order.status,
            Order.Status.PAYMENT_PROCESSING,
            "A stale failure callback for a superseded payment attempt knocked the order back to failed.",
        )

        # The retry then succeeds normally.
        second_token = _extract_mock_token(second_start.data["redirect_url"])
        success_response = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": second_start.data["attempt_id"], "outcome": "success", "mock_token": second_token},
            format="json",
        )
        self.assertEqual(success_response.data["outcome"], "success")
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 4)

    def test_stale_success_from_a_superseded_attempt_does_not_reapply_effects(self):
        product, order = self._place_physical_order(stock=5)
        first_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        first_token = _extract_mock_token(first_start.data["redirect_url"])
        # start_payment only allows starting a new attempt for an order in
        # PENDING_PAYMENT/PAYMENT_FAILED -- the first attempt must actually
        # fail before a retry can begin, same as the real retry flow.
        self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": first_start.data["attempt_id"], "outcome": "failure", "mock_token": first_token},
            format="json",
        )

        second_start = self.client.post(
            "/api/shop/payments/start/", {"order_number": order.order_number}, format="json"
        )
        second_token = _extract_mock_token(second_start.data["redirect_url"])
        self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": second_start.data["attempt_id"], "outcome": "success", "mock_token": second_token},
            format="json",
        )
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
        product.physical_detail.refresh_from_db()
        self.assertEqual(product.physical_detail.inventory_qty, 4)

        # The FIRST attempt's own success callback finally arrives late,
        # after the retry already completed the order.
        stale_success = self.client.post(
            "/api/shop/payments/callback/mock/",
            {"attempt_id": first_start.data["attempt_id"], "outcome": "success", "mock_token": first_token},
            format="json",
        )
        self.assertEqual(stale_success.data["outcome"], "success")  # the ATTEMPT really did succeed too
        product.physical_detail.refresh_from_db()
        self.assertEqual(
            product.physical_detail.inventory_qty,
            4,
            "A stale success from a superseded attempt double-decremented inventory.",
        )
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)


class OrderCanRetryPaymentFieldTests(TestCase):
    """FE-SHOP-ORDER-PENDING-PAYMENT-RETRY-001: can_retry_payment only
    ever reported True for PAYMENT_FAILED, even though
    PaymentStartAPIView/start_payment() already accept PENDING_PAYMENT --
    exactly the state an order is left in when a payment-start attempt
    fails before ever reaching the provider (start_payment() is one atomic
    transaction, so a failure there rolls back even the PaymentAttempt row
    with it, leaving latest_payment_attempt null)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="retry_payer", password="x")
        self.client.force_authenticate(self.user)

    def _place_order(self):
        product = make_physical_product()
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        return checkout_service.place_order(cart, self.user)

    def test_can_retry_payment_is_true_for_a_freshly_placed_pending_payment_order(self):
        order = self._place_order()
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)

        response = self.client.get(f"/api/shop/orders/{order.order_number}/")

        self.assertTrue(response.data["can_retry_payment"])
        self.assertIsNone(response.data["latest_payment_attempt"])

    def test_can_retry_payment_is_true_for_a_payment_failed_order(self):
        order = self._place_order()
        order.status = Order.Status.PAYMENT_FAILED
        order.save(update_fields=["status"])

        response = self.client.get(f"/api/shop/orders/{order.order_number}/")

        self.assertTrue(response.data["can_retry_payment"])

    def test_can_retry_payment_is_false_once_paid(self):
        order = self._place_order()
        order.status = Order.Status.PAID
        order.save(update_fields=["status"])

        response = self.client.get(f"/api/shop/orders/{order.order_number}/")

        self.assertFalse(response.data["can_retry_payment"])
