from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.shop.models import (
    OnlineCourseDetail,
    PhysicalProductDetail,
    Product,
    ShippingMethod,
    ShopCategory,
)

# Markers matched exactly by cleanup_shop_e2e_demo.py -- keep both files in sync.
CATEGORY_SLUG = "shop-e2e-category"
BOOK_SLUG = "shop-e2e-book"
COURSE_SLUG = "shop-e2e-course"
SHIPPING_TITLE = "پست آزمون مرورگر"


class Command(BaseCommand):
    help = (
        "Seed the minimal fixture the real-Django shop E2E lane "
        "(frontend/tests/e2e/shop-real-django.spec.ts) exercises: one "
        "published physical book, one published online course, and one "
        "shipping method. Test-only; never auto-run outside the E2E harness."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        category, _ = ShopCategory.objects.get_or_create(
            slug=CATEGORY_SLUG, defaults={"title": "دسته‌بندی آزمون مرورگر"}
        )

        today = timezone.localdate()

        book, book_created = Product.objects.get_or_create(
            slug=BOOK_SLUG,
            defaults=dict(
                product_type=Product.ProductType.PHYSICAL,
                title="کتاب آزمون مرورگر",
                category=category,
                short_description="کتاب آزمایشی برای مسیر خرید کالای فیزیکی.",
                description="<p>توضیح آزمایشی کتاب.</p>",
                price_amount=250_000,
                status=Product.Status.PUBLISHED,
                published_at=today,
            ),
        )
        PhysicalProductDetail.objects.get_or_create(
            product=book,
            defaults=dict(sku="SHOP-E2E-BOOK", inventory_qty=50, requires_shipping=True),
        )

        course, course_created = Product.objects.get_or_create(
            slug=COURSE_SLUG,
            defaults=dict(
                product_type=Product.ProductType.ONLINE_COURSE,
                title="دوره آزمون مرورگر",
                category=category,
                short_description="دوره آزمایشی برای مسیر خرید دوره آنلاین.",
                description="<p>توضیح آزمایشی دوره.</p>",
                price_amount=400_000,
                status=Product.Status.PUBLISHED,
                published_at=today,
            ),
        )
        OnlineCourseDetail.objects.get_or_create(
            product=course,
            defaults=dict(
                instructor_name="مدرس آزمایشی",
                access_destination_type=OnlineCourseDetail.AccessDestinationType.EXTERNAL_LINK,
                access_destination_value="https://class.example.invalid/e2e-room",
            ),
        )

        shipping, shipping_created = ShippingMethod.objects.get_or_create(
            title=SHIPPING_TITLE, defaults={"price_amount": 50_000, "is_default": True}
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"shop E2E demo seed complete: book_created={book_created}, "
                f"course_created={course_created}, shipping_created={shipping_created}"
            )
        )
