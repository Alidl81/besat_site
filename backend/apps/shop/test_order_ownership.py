from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Address
from .services import cart_service, checkout_service
from .tests import make_physical_product

User = get_user_model()


class OrderOwnershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="owner", password="x")
        self.other = User.objects.create_user(username="intruder", password="x")

        product = make_physical_product()
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.owner)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        self.order = checkout_service.place_order(cart, self.owner)

    def test_owner_can_read_their_order(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/shop/orders/{self.order.order_number}/")
        self.assertEqual(response.status_code, 200)

    def test_other_user_gets_404_not_403(self):
        """404, not 403 -- so a probing request can't even confirm the
        order number exists."""
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/shop/orders/{self.order.order_number}/")
        self.assertEqual(response.status_code, 404)

    def test_order_list_never_includes_another_users_orders(self):
        other_product = make_physical_product(title="محصول دیگر")
        other_product.physical_detail.requires_shipping = False
        other_product.physical_detail.save()
        other_cart, _ = cart_service.get_or_create_active_cart(user=self.other)
        cart_service.add_item(other_cart, product_id=other_product.pk, variant_id=None, quantity=1)
        checkout_service.place_order(other_cart, self.other)

        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/shop/orders/")

        order_numbers = [item["order_number"] for item in response.data["results"]]
        self.assertIn(self.order.order_number, order_numbers)
        self.assertEqual(len(order_numbers), 1)

    def test_anonymous_user_cannot_list_or_create_orders(self):
        self.assertEqual(self.client.get("/api/shop/orders/").status_code, 401)
        self.assertEqual(self.client.post("/api/shop/orders/", {}, format="json").status_code, 401)


class AddressOwnershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="addr_owner", password="x")
        self.other = User.objects.create_user(username="addr_intruder", password="x")
        self.address = Address.objects.create(
            user=self.owner,
            recipient_full_name="مالک آدرس",
            phone="09121111111",
            province="تهران",
            city="تهران",
            address_line1="خیابان ولیعصر",
        )

    def test_other_user_cannot_read_address(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/shop/addresses/{self.address.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_other_user_cannot_modify_address(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch(
            f"/api/shop/addresses/{self.address.pk}/", {"city": "مشهد"}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.address.refresh_from_db()
        self.assertEqual(self.address.city, "تهران")

    def test_other_user_cannot_delete_address(self):
        self.client.force_authenticate(self.other)
        response = self.client.delete(f"/api/shop/addresses/{self.address.pk}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Address.objects.filter(pk=self.address.pk).exists())

    def test_address_list_is_scoped_to_owner(self):
        Address.objects.create(
            user=self.other,
            recipient_full_name="دیگری",
            phone="09122222222",
            province="فارس",
            city="شیراز",
            address_line1="خیابان زند",
        )

        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/shop/addresses/")

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.address.pk)
