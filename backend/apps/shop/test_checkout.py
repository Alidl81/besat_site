from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Address, Order, ShippingMethod
from .services import cart_service, checkout_service
from .tests import make_online_course, make_physical_product

User = get_user_model()


class CheckoutPreviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="buyer1", password="x")
        self.client.force_authenticate(self.user)
        self.shipping = ShippingMethod.objects.create(title="پست پیشتاز", price_amount=200_000)

    def test_physical_only_cart_requires_shipping_and_sums_correctly(self):
        product = make_physical_product(price_amount=500_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=2)

        response = self.client.post(
            "/api/shop/checkout/preview/", {"shipping_method_id": self.shipping.pk}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["requires_shipping"])
        self.assertEqual(response.data["subtotal_amount"], 1_000_000)
        self.assertEqual(response.data["shipping_amount"], 200_000)
        self.assertEqual(response.data["total_amount"], 1_200_000)
        self.assertTrue(response.data["can_checkout"])

    def test_course_only_cart_does_not_require_shipping(self):
        course = make_online_course(price_amount=900_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=course.pk, variant_id=None, quantity=1)

        response = self.client.post("/api/shop/checkout/preview/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["requires_shipping"])
        self.assertEqual(response.data["shipping_amount"], 0)
        self.assertEqual(response.data["total_amount"], 900_000)

    def test_mixed_cart_requires_shipping(self):
        physical = make_physical_product(price_amount=300_000)
        course = make_online_course(price_amount=900_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=physical.pk, variant_id=None, quantity=1)
        cart_service.add_item(cart, product_id=course.pk, variant_id=None, quantity=1)

        response = self.client.post("/api/shop/checkout/preview/", {}, format="json")

        self.assertTrue(response.data["requires_shipping"])
        self.assertEqual(response.data["subtotal_amount"], 1_200_000)


class PlaceOrderTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="buyer2", password="x")
        self.client.force_authenticate(self.user)
        self.shipping = ShippingMethod.objects.create(title="پست پیشتاز", price_amount=200_000)
        self.address = Address.objects.create(
            user=self.user,
            recipient_full_name="علی رضایی",
            phone="09120000000",
            province="تهران",
            city="تهران",
            address_line1="خیابان آزادی",
        )

    def test_physical_order_without_address_is_rejected(self):
        product = make_physical_product()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)

        response = self.client.post(
            "/api/shop/orders/", {"shipping_method_id": self.shipping.pk}, format="json"
        )

        self.assertEqual(response.status_code, 400)

    def test_physical_order_creates_snapshot_and_reservation(self):
        product = make_physical_product(price_amount=500_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=2)

        response = self.client.post(
            "/api/shop/orders/",
            {"shipping_method_id": self.shipping.pk, "address_id": self.address.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(order_number=response.data["order_number"])
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        self.assertEqual(order.total_amount, 1_200_000)
        self.assertEqual(order.shipping_recipient_name, "علی رضایی")

        order_item = order.items.get()
        self.assertEqual(order_item.title_snapshot, product.title)
        self.assertEqual(order_item.unit_price_amount_snapshot, 500_000)
        self.assertTrue(hasattr(order_item, "reservation"))
        self.assertEqual(order_item.reservation.quantity, 2)

        # Product edits after the order must never change the snapshot.
        product.title = "عنوان جدید"
        product.price_amount = 999_999
        product.save()
        order_item.refresh_from_db()
        self.assertNotEqual(order_item.title_snapshot, "عنوان جدید")
        self.assertEqual(order_item.unit_price_amount_snapshot, 500_000)

    def test_price_tampering_from_client_is_ignored(self):
        product = make_physical_product(price_amount=500_000)
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)

        response = self.client.post(
            "/api/shop/orders/",
            {
                "shipping_method_id": self.shipping.pk,
                "address_id": self.address.pk,
                "total_amount": 1,
                "subtotal_amount": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(order_number=response.data["order_number"])
        self.assertEqual(order.total_amount, 700_000)

    def test_out_of_stock_checkout_is_rejected(self):
        product = make_physical_product()
        product.physical_detail.inventory_qty = 1
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=5)

        response = self.client.post(
            "/api/shop/orders/",
            {"shipping_method_id": self.shipping.pk, "address_id": self.address.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_double_submit_second_call_fails_because_cart_already_converted(self):
        product = make_physical_product()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)

        payload = {"shipping_method_id": self.shipping.pk, "address_id": self.address.pk}
        first = self.client.post("/api/shop/orders/", payload, format="json")
        second = self.client.post("/api/shop/orders/", payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)

    def test_empty_cart_cannot_checkout(self):
        response = self.client.post(
            "/api/shop/orders/",
            {"shipping_method_id": self.shipping.pk, "address_id": self.address.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_course_checkout_does_not_require_address(self):
        course = make_online_course()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        cart_service.add_item(cart, product_id=course.pk, variant_id=None, quantity=1)

        response = self.client.post("/api/shop/orders/", {}, format="json")

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(order_number=response.data["order_number"])
        self.assertFalse(order.requires_shipping)
        self.assertIsNone(order.shipping_recipient_name)


class CheckoutServiceDirectTests(TestCase):
    """Covers CheckoutError branches that are easiest to exercise by
    calling the service directly rather than round-tripping through DRF."""

    def setUp(self):
        self.user = User.objects.create_user(username="buyer3", password="x")

    def test_place_order_raises_on_max_quantity_exceeded(self):
        product = make_physical_product()
        product.physical_detail.max_purchase_quantity = 2
        product.physical_detail.inventory_qty = 10
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.user)
        item = cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        item.quantity = 5
        item.save()

        with self.assertRaises(checkout_service.CheckoutError) as ctx:
            checkout_service.place_order(cart, self.user)

        self.assertEqual(ctx.exception.code, "max_quantity_exceeded")
