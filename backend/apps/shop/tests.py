from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.units.models import SchoolUnit

from .models import (
    InPersonCourseDetail,
    OnlineCourseDetail,
    PhysicalProductDetail,
    Product,
    ShippingMethod,
    ShopCategory,
)


def make_physical_product(**overrides):
    defaults = dict(
        product_type=Product.ProductType.PHYSICAL,
        title="کتاب ریاضی هفتم",
        short_description="کتاب کمک‌درسی ریاضی پایه هفتم",
        description="<p>توضیحات کامل کتاب</p>",
        price_amount=500_000,
        status=Product.Status.PUBLISHED,
        published_at=timezone.localdate(),
    )
    defaults.update(overrides)
    product = Product.objects.create(**defaults)
    PhysicalProductDetail.objects.create(product=product, sku=f"SKU-{product.pk}", inventory_qty=10)
    return product


def make_online_course(**overrides):
    defaults = dict(
        product_type=Product.ProductType.ONLINE_COURSE,
        title="دوره آنلاین زبان انگلیسی",
        short_description="دوره آموزش زبان انگلیسی سطح مقدماتی",
        description="<p>توضیحات دوره</p>",
        price_amount=1_200_000,
        status=Product.Status.PUBLISHED,
        published_at=timezone.localdate(),
    )
    defaults.update(overrides)
    product = Product.objects.create(**defaults)
    OnlineCourseDetail.objects.create(
        product=product,
        instructor_name="خانم احمدی",
        capacity=30,
        access_destination_value="https://class.example.com/secret",
    )
    return product


def make_in_person_course(**overrides):
    defaults = dict(
        product_type=Product.ProductType.IN_PERSON_COURSE,
        title="کارگاه حضوری نقاشی",
        short_description="کارگاه آموزش نقاشی برای دانش‌آموزان",
        description="<p>توضیحات کارگاه</p>",
        price_amount=800_000,
        status=Product.Status.PUBLISHED,
        published_at=timezone.localdate(),
    )
    defaults.update(overrides)
    product = Product.objects.create(**defaults)
    InPersonCourseDetail.objects.create(product=product, capacity=15)
    return product


class ShopPublicCatalogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = ShopCategory.objects.create(title="کتاب‌ها")

    def test_list_returns_only_published_active_products(self):
        make_physical_product(title="کتاب منتشرشده")
        make_physical_product(title="کتاب پیش‌نویس", status=Product.Status.DRAFT, published_at=None)
        make_physical_product(
            title="کتاب آینده",
            published_at=timezone.localdate() + timedelta(days=5),
        )
        make_physical_product(title="کتاب غیرفعال", is_active=False)

        response = self.client.get("/api/shop/products/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["کتاب منتشرشده"])

    def test_detail_returns_type_specific_fields_without_leaking_private_access_data(self):
        course = make_online_course()

        response = self.client.get(f"/api/shop/products/{course.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["product_type"], "online_course")
        self.assertEqual(response.data["course_detail"]["instructor_name"], "خانم احمدی")
        self.assertEqual(response.data["course_detail"]["seats_left"], 30)
        self.assertNotIn("access_destination_value", response.data["course_detail"])

    def test_filter_by_product_type(self):
        make_physical_product()
        make_online_course()

        response = self.client.get("/api/shop/products/", {"type": "online_course"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["product_type"], "online_course")

    def test_filter_by_category_slug(self):
        make_physical_product(category=self.category)
        make_physical_product(title="بدون دسته")

        response = self.client.get("/api/shop/products/", {"category": self.category.slug})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_filter_by_price_range(self):
        make_physical_product(title="ارزان", price_amount=100_000)
        make_physical_product(title="گران", price_amount=900_000)

        response = self.client.get("/api/shop/products/", {"price_min": 500_000})

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["گران"])

    def test_filter_by_featured(self):
        make_physical_product(title="ویژه", is_featured=True)
        make_physical_product(title="عادی", is_featured=False)

        response = self.client.get("/api/shop/products/", {"featured": "true"})

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["ویژه"])

    def test_search_by_title(self):
        make_physical_product(title="کتاب فیزیک")
        make_physical_product(title="کتاب شیمی")

        response = self.client.get("/api/shop/products/", {"search": "فیزیک"})

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["کتاب فیزیک"])

    def test_ordering_by_price(self):
        make_physical_product(title="ارزان", price_amount=100_000)
        make_physical_product(title="گران", price_amount=900_000)

        response = self.client.get("/api/shop/products/", {"ordering": "price_amount"})

        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["ارزان", "گران"])

    def test_in_person_course_exposes_unit_and_schedule(self):
        unit = SchoolUnit.objects.create(title="دبستان بعثت")
        course = make_in_person_course()
        course.in_person_course_detail.unit = unit
        course.in_person_course_detail.schedule_text = "پنجشنبه‌ها ساعت ۱۶"
        course.in_person_course_detail.save()

        response = self.client.get(f"/api/shop/products/{course.slug}/")

        self.assertEqual(response.data["course_detail"]["unit"]["title"], "دبستان بعثت")
        self.assertEqual(response.data["course_detail"]["schedule_text"], "پنجشنبه‌ها ساعت ۱۶")

    def test_categories_endpoint_returns_only_active(self):
        ShopCategory.objects.create(title="فعال", is_active=True)
        ShopCategory.objects.create(title="غیرفعال", is_active=False)

        response = self.client.get("/api/shop/categories/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data]
        self.assertIn("فعال", titles)
        self.assertNotIn("غیرفعال", titles)

    def test_price_and_display_fields_present(self):
        make_physical_product(price_amount=1_000_000, sale_price_amount=800_000)

        response = self.client.get("/api/shop/products/")

        item = response.data["results"][0]
        self.assertEqual(item["price_amount"], 1_000_000)
        self.assertEqual(item["sale_price_amount"], 800_000)
        self.assertTrue(item["is_on_sale"])
        self.assertEqual(item["price_display"], "100,000")
        self.assertEqual(item["sale_price_display"], "80,000")

    def test_shipping_methods_endpoint_returns_only_active(self):
        ShippingMethod.objects.create(title="پست پیشتاز", price_amount=300_000, is_active=True)
        ShippingMethod.objects.create(title="روش غیرفعال", price_amount=100_000, is_active=False)

        response = self.client.get("/api/shop/shipping-methods/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data]
        self.assertIn("پست پیشتاز", titles)
        self.assertNotIn("روش غیرفعال", titles)
