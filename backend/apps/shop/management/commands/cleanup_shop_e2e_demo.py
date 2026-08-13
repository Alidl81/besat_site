from django.core.management.base import BaseCommand
from django.db import transaction

from apps.shop.models import Product, ShippingMethod, ShopCategory

from .seed_shop_e2e_demo import BOOK_SLUG, CATEGORY_SLUG, COURSE_SLUG, SHIPPING_TITLE


class Command(BaseCommand):
    help = (
        "Delete exactly the fixture seed_shop_e2e_demo creates. Safe to run "
        "even when nothing was seeded -- the real-Django shop E2E lane "
        "always calls this in a finally block."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        products_queryset = Product.objects.filter(slug__in=(BOOK_SLUG, COURSE_SLUG))
        categories_queryset = ShopCategory.objects.filter(slug=CATEGORY_SLUG)
        shipping_queryset = ShippingMethod.objects.filter(title=SHIPPING_TITLE)

        products_deleted = products_queryset.count()
        categories_deleted = categories_queryset.count()
        shipping_deleted = shipping_queryset.count()

        products_queryset.delete()
        categories_queryset.delete()
        shipping_queryset.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"shop E2E demo cleanup complete: products_deleted={products_deleted}, "
                f"categories_deleted={categories_deleted}, shipping_deleted={shipping_deleted}"
            )
        )
