"""IDOR/ownership tests for cart item mutation, added as part of the
ASVS/authorization audit in docs/security/.

apps/shop/test_order_ownership.py already covers order/address ownership.
Cart item mutation (CartItemDetailAPIView.patch/delete) was not covered by
that file and reads as correct on inspection -- cart_service.
update_item_quantity/remove_item both resolve item_id through the related
manager (cart.items.get(pk=item_id) / cart.items.filter(pk=item_id)),
never a global CartItem lookup -- but per this audit's own standard that
must be proven by a real request, not just a code read.

Cart identity has two paths worth testing: authenticated user (cart tied
to request.user) and guest (cart tied to an opaque X-Guest-Cart-Token
header value) -- both are AllowAny endpoints by design (guest checkout is
a real product requirement), so the isolation has to come entirely from
correct item_id-to-cart scoping, not from authentication.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CartItem
from .services import cart_service
from .tests import make_physical_product

User = get_user_model()


class CartItemOwnershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="cart_owner", password="x")
        self.intruder = User.objects.create_user(username="cart_intruder", password="x")

        product = make_physical_product()
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()

        self.owner_cart, _ = cart_service.get_or_create_active_cart(user=self.owner)
        self.owner_item = cart_service.add_item(
            self.owner_cart, product_id=product.pk, variant_id=None, quantity=1,
        )

    def test_other_authenticated_user_cannot_update_someone_elses_cart_item(self):
        self.client.force_authenticate(self.intruder)

        response = self.client.patch(
            f"/api/shop/cart/items/{self.owner_item.pk}/",
            {"quantity": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("detail"), "آیتم سبد یافت نشد.")
        self.owner_item.refresh_from_db()
        self.assertEqual(
            self.owner_item.quantity,
            1,
            "IDOR: another authenticated user's cart-item PATCH mutated the owner's cart.",
        )

    def test_other_authenticated_user_cannot_delete_someone_elses_cart_item(self):
        self.client.force_authenticate(self.intruder)

        response = self.client.delete(f"/api/shop/cart/items/{self.owner_item.pk}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(
            CartItem.objects.filter(pk=self.owner_item.pk).exists(),
            "IDOR: another authenticated user's cart-item DELETE removed the owner's item.",
        )

    def test_guest_cannot_update_a_different_guests_cart_item(self):
        guest_a_cart, guest_a_token = cart_service.get_or_create_active_cart(
            user=None, guest_token=None,
        )
        product = make_physical_product()
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        guest_a_item = cart_service.add_item(
            guest_a_cart, product_id=product.pk, variant_id=None, quantity=1,
        )

        # A second, unrelated guest (no token, or a different/bogus token)
        # attempts to mutate guest A's item by guessing its ID.
        response = self.client.patch(
            f"/api/shop/cart/items/{guest_a_item.pk}/",
            {"quantity": 9},
            format="json",
            HTTP_X_GUEST_CART_TOKEN="a-different-guests-token-entirely",
        )

        self.assertEqual(response.status_code, 400)
        guest_a_item.refresh_from_db()
        self.assertEqual(
            guest_a_item.quantity,
            1,
            "IDOR: an unrelated guest cart token could mutate another guest's cart item.",
        )

    def test_owner_can_update_their_own_cart_item(self):
        """Sanity check: the isolation above must not also break the
        legitimate case."""
        self.client.force_authenticate(self.owner)

        response = self.client.patch(
            f"/api/shop/cart/items/{self.owner_item.pk}/",
            {"quantity": 3},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.owner_item.refresh_from_db()
        self.assertEqual(self.owner_item.quantity, 3)
