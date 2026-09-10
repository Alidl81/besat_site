from django.core.management.base import BaseCommand, CommandError

from apps.shop.payments import get_payment_provider


class Command(BaseCommand):
    help = (
        "Fail loudly at startup if SHOP_PAYMENT_PROVIDER does not resolve "
        "to an actually-registered payment provider (apps/shop/payments/"
        "registry.py). Run from entrypoint.sh, before gunicorn starts, so "
        "a typo'd/unimplemented provider name aborts the deploy instead of "
        "surfacing as an uncaught 500 the first time a real customer "
        "starts checkout -- the production settings guard "
        "(_production_guard.py) can reject a known-unsafe value like "
        "'mock', but can't safely import apps.shop.payments.registry "
        "itself (Django's app registry isn't ready yet while settings "
        "modules are still being evaluated), so that check happens here "
        "instead, as a real command run after the app registry is up."
    )

    def handle(self, *args, **options):
        try:
            provider = get_payment_provider()
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f"Payment provider OK: {provider.name}"))
