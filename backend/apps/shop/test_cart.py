from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Cart, CartItem
from .tests import make_in_person_course, make_online_course, make_physical_product

User = get_user_model()


class GuestCartTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_cart_without_token_creates_guest_cart_and_returns_token(self):
        response = self.client.get("/api/shop/cart/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("X-Guest-Cart-Token", response)
        self.assertEqual(response.data["items"], [])

    def test_add_item_persists_across_requests_with_same_token(self):
        product = make_physical_product()

        first = self.client.get("/api/shop/cart/")
        token = first["X-Guest-Cart-Token"]

        add_response = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 2},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(add_response.status_code, 201)
        self.assertEqual(len(add_response.data["items"]), 1)
        self.assertEqual(add_response.data["items"][0]["quantity"], 2)

        second = self.client.get("/api/shop/cart/", HTTP_X_GUEST_CART_TOKEN=token)
        self.assertEqual(len(second.data["items"]), 1)
        self.assertEqual(second.data["items"][0]["quantity"], 2)

    def test_add_item_beyond_stock_is_rejected(self):
        product = make_physical_product()
        product.physical_detail.inventory_qty = 3
        product.physical_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json"
        )
        token = response["X-Guest-Cart-Token"]

        response = self.client.patch(
            f"/api/shop/cart/items/{response.data['items'][0]['id']}/",
            {"quantity": 3},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["items"][0]["issue"])

    def test_cart_flags_out_of_stock_item_without_blocking_add(self):
        # Adding a quantity higher than stock is allowed at cart level
        # (soft, informational) -- checkout is what actually blocks it.
        product = make_physical_product()
        product.physical_detail.inventory_qty = 1
        product.physical_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 5}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["issue"], "insufficient_stock")
        self.assertTrue(response.data["has_blocking_issue"])

    def test_remove_item(self):
        product = make_physical_product()
        add_response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
        )
        token = add_response["X-Guest-Cart-Token"]
        item_id = add_response.data["items"][0]["id"]

        response = self.client.delete(f"/api/shop/cart/items/{item_id}/", HTTP_X_GUEST_CART_TOKEN=token)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"], [])

    def test_course_quantity_is_forced_to_one(self):
        course = make_online_course()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": course.pk, "quantity": 3}, format="json"
        )

        self.assertEqual(response.status_code, 400)

    def test_in_person_course_full_capacity_is_flagged(self):
        course = make_in_person_course()
        course.in_person_course_detail.capacity = 1
        course.in_person_course_detail.enrolled_count = 1
        course.in_person_course_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": course.pk, "quantity": 1}, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["issue"], "course_full")


class AuthenticatedCartTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="parent1", password="x")
        self.client.force_authenticate(self.user)

    def test_cart_is_scoped_to_authenticated_user(self):
        product = make_physical_product()
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json")

        self.assertEqual(Cart.objects.filter(user=self.user).count(), 1)
        self.assertEqual(CartItem.objects.filter(cart__user=self.user).count(), 1)

    def test_reused_active_cart_across_requests(self):
        product = make_physical_product()
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json")
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json")

        self.assertEqual(Cart.objects.filter(user=self.user, status=Cart.Status.ACTIVE).count(), 1)
        item = CartItem.objects.get(cart__user=self.user)
        self.assertEqual(item.quantity, 3)


class CartMergeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="parent2", password="x")

    def test_merge_sums_duplicate_lines_and_adds_new_ones(self):
        shared_product = make_physical_product(title="کتاب مشترک")
        guest_only_product = make_physical_product(title="فقط مهمان")

        guest_response = self.client.post(
            "/api/shop/cart/items/", {"product_id": shared_product.pk, "quantity": 2}, format="json"
        )
        guest_token = guest_response["X-Guest-Cart-Token"]
        self.client.post(
            "/api/shop/cart/items/",
            {"product_id": guest_only_product.pk, "quantity": 1},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=guest_token,
        )

        self.client.force_authenticate(self.user)
        self.client.post("/api/shop/cart/items/", {"product_id": shared_product.pk, "quantity": 1}, format="json")

        merge_response = self.client.post(
            "/api/shop/cart/merge/", HTTP_X_GUEST_CART_TOKEN=guest_token
        )

        self.assertEqual(merge_response.status_code, 200)
        self.assertEqual(merge_response["X-Guest-Cart-Token-Clear"], "1")
        items_by_title = {item["product"]["title"]: item["quantity"] for item in merge_response.data["items"]}
        self.assertEqual(items_by_title["کتاب مشترک"], 3)
        self.assertEqual(items_by_title["فقط مهمان"], 1)

        guest_cart = Cart.objects.get(guest_token=guest_token)
        self.assertEqual(guest_cart.status, Cart.Status.MERGED)

    def test_merge_requires_authentication(self):
        response = self.client.post("/api/shop/cart/merge/")
        self.assertEqual(response.status_code, 401)
