from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile

from .models import Order, Product, ShippingMethod, ShopCategory
from .services import cart_service, checkout_service
from .tests import make_physical_product

User = get_user_model()


class ShopCMSPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = ShopCategory.objects.create(title="کتاب‌ها")

        self.general_manager = self._create_user("gm", UserProfile.Role.GENERAL_MANAGER)
        self.unit_media = self._create_user("media", UserProfile.Role.UNIT_MEDIA)
        self.unit_manager = self._create_user("manager", UserProfile.Role.UNIT_MANAGER)
        self.parent = self._create_user("parent", UserProfile.Role.PARENT)

    def _create_user(self, username, role):
        user = User.objects.create_user(username=username, password="x")
        UserProfile.objects.filter(user=user).update(role=role)
        return user

    def _as(self, user):
        self.client.force_authenticate(user=user)

    # --- Products: creation & field-level gating -------------------------

    def test_general_manager_can_create_product_with_price_and_inventory(self):
        self._as(self.general_manager)
        response = self.client.post(
            "/api/cms/shop/products/",
            {
                "product_type": "physical",
                "title": "کتاب علوم",
                "short_description": "توضیح کوتاه",
                "price_amount": 400000,
                "physical_detail": {"sku": "SKU-GM-1", "inventory_qty": 10},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["price_amount"], 400000)
        self.assertEqual(response.data["physical_detail"]["inventory_qty"], 10)

    def test_media_manager_can_create_draft_product_with_content_fields_only(self):
        self._as(self.unit_media)
        response = self.client.post(
            "/api/cms/shop/products/",
            {"product_type": "physical", "title": "کتاب هنر", "short_description": "توضیح"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], Product.Status.DRAFT)

    def test_media_manager_cannot_set_price_on_create(self):
        self._as(self.unit_media)
        response = self.client.post(
            "/api/cms/shop/products/",
            {"product_type": "physical", "title": "کتاب هنر", "price_amount": 100000},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_media_manager_cannot_send_physical_detail(self):
        self._as(self.unit_media)
        response = self.client.post(
            "/api/cms/shop/products/",
            {
                "product_type": "physical", "title": "کتاب هنر",
                "physical_detail": {"sku": "X", "inventory_qty": 5},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unit_manager_cannot_access_product_cms_at_all(self):
        self._as(self.unit_manager)
        response = self.client.get("/api/cms/shop/products/")
        self.assertEqual(response.status_code, 403)

    def test_parent_cannot_access_product_cms_at_all(self):
        self._as(self.parent)
        response = self.client.get("/api/cms/shop/products/")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_access_product_cms(self):
        response = self.client.get("/api/cms/shop/products/")
        self.assertIn(response.status_code, (401, 403))

    # --- Workflow: submit/approve/publish/reject/archive/restore ---------

    def _create_draft_product(self, *, user=None):
        product = Product.objects.create(
            product_type=Product.ProductType.PHYSICAL,
            title="محصول آزمایشی",
            short_description="خلاصه",
            description="<p>توضیح کامل</p>",
            price_amount=250000,
        )
        from .models import PhysicalProductDetail

        PhysicalProductDetail.objects.create(product=product, sku=f"SKU-{product.pk}", inventory_qty=5)
        return product

    def test_media_manager_can_submit_review_but_not_approve_or_publish(self):
        product = self._create_draft_product()
        self._as(self.unit_media)

        submit = self.client.post(f"/api/cms/shop/products/{product.pk}/submit-review/")
        self.assertEqual(submit.status_code, 200, submit.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.WAITING_REVIEW)

        approve = self.client.post(f"/api/cms/shop/products/{product.pk}/approve/")
        self.assertEqual(approve.status_code, 403)

    def test_general_manager_can_run_full_workflow_to_published(self):
        product = self._create_draft_product()
        self._as(self.general_manager)

        self.client.post(f"/api/cms/shop/products/{product.pk}/submit-review/")
        self.client.post(f"/api/cms/shop/products/{product.pk}/approve/")
        publish = self.client.post(f"/api/cms/shop/products/{product.pk}/publish/")

        self.assertEqual(publish.status_code, 200, publish.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PUBLISHED)
        self.assertIsNotNone(product.published_at)
        self.assertEqual(product.published_by, self.general_manager)

    def test_publish_is_general_manager_only_even_when_approved(self):
        product = self._create_draft_product()
        product.status = Product.Status.APPROVED
        product.save(update_fields=["status"])

        self._as(self.unit_media)
        response = self.client.post(f"/api/cms/shop/products/{product.pk}/publish/")
        self.assertEqual(response.status_code, 403)

    def test_media_manager_cannot_delete_product(self):
        product = self._create_draft_product()
        self._as(self.unit_media)
        response = self.client.delete(f"/api/cms/shop/products/{product.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Product.objects.filter(pk=product.pk).exists())

    def test_general_manager_can_delete_product(self):
        product = self._create_draft_product()
        self._as(self.general_manager)
        response = self.client.delete(f"/api/cms/shop/products/{product.pk}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Product.objects.filter(pk=product.pk).exists())

    def test_media_manager_cannot_edit_a_published_product(self):
        product = self._create_draft_product()
        product.status = Product.Status.PUBLISHED
        product.published_at = product.created_at.date()
        product.save()

        self._as(self.unit_media)
        response = self.client.patch(
            f"/api/cms/shop/products/{product.pk}/", {"title": "تغییر عنوان"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    # --- Categories --------------------------------------------------------

    def test_media_manager_can_read_but_not_write_categories(self):
        self._as(self.unit_media)
        self.assertEqual(self.client.get("/api/cms/shop/categories/").status_code, 200)
        response = self.client.post("/api/cms/shop/categories/", {"title": "جدید"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_write_categories(self):
        self._as(self.general_manager)
        response = self.client.post("/api/cms/shop/categories/", {"title": "لوازم‌التحریر"}, format="json")
        self.assertEqual(response.status_code, 201)

    # --- Orders / payments / settings / shipping / enrollments: GM-only ---

    def _place_paid_order_setup(self):
        product = make_physical_product()
        product.physical_detail.requires_shipping = False
        product.physical_detail.save()
        cart, _ = cart_service.get_or_create_active_cart(user=self.parent)
        cart_service.add_item(cart, product_id=product.pk, variant_id=None, quantity=1)
        return checkout_service.place_order(cart, self.parent)

    def test_only_general_manager_can_list_orders_in_cms(self):
        self._place_paid_order_setup()

        for user, expected in (
            (self.general_manager, 200),
            (self.unit_media, 403),
            (self.unit_manager, 403),
            (self.parent, 403),
        ):
            self._as(user)
            response = self.client.get("/api/cms/shop/orders/")
            self.assertEqual(response.status_code, expected, f"role={user.username}")

    def test_only_general_manager_can_cancel_an_order(self):
        order = self._place_paid_order_setup()

        self._as(self.unit_media)
        response = self.client.post(f"/api/cms/shop/orders/{order.pk}/cancel/")
        self.assertEqual(response.status_code, 403)

        self._as(self.general_manager)
        response = self.client.post(f"/api/cms/shop/orders/{order.pk}/cancel/")
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

    def test_only_general_manager_can_access_payments_cms(self):
        for user, expected in (
            (self.general_manager, 200),
            (self.unit_media, 403),
            (self.unit_manager, 403),
            (self.parent, 403),
        ):
            self._as(user)
            response = self.client.get("/api/cms/shop/payments/")
            self.assertEqual(response.status_code, expected, f"role={user.username}")

    def test_only_general_manager_can_access_settings(self):
        self._as(self.unit_media)
        self.assertEqual(self.client.get("/api/cms/shop/settings/").status_code, 403)

        self._as(self.general_manager)
        get_response = self.client.get("/api/cms/shop/settings/")
        self.assertEqual(get_response.status_code, 200)

        patch_response = self.client.patch(
            "/api/cms/shop/settings/", {"reservation_hold_minutes": 30}, format="json"
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.data["reservation_hold_minutes"], 30)

    def test_only_general_manager_can_manage_shipping_methods(self):
        self._as(self.unit_media)
        response = self.client.post(
            "/api/cms/shop/shipping-methods/", {"title": "پست عادی", "price_amount": 100000}, format="json"
        )
        self.assertEqual(response.status_code, 403)

        self._as(self.general_manager)
        response = self.client.post(
            "/api/cms/shop/shipping-methods/", {"title": "پست عادی", "price_amount": 100000}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(ShippingMethod.objects.filter(title="پست عادی").exists())

    def test_only_general_manager_can_list_course_enrollments(self):
        for user, expected in (
            (self.general_manager, 200),
            (self.unit_media, 403),
            (self.unit_manager, 403),
            (self.parent, 403),
        ):
            self._as(user)
            response = self.client.get("/api/cms/shop/course-enrollments/")
            self.assertEqual(response.status_code, expected, f"role={user.username}")
