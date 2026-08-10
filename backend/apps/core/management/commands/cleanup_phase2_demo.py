from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.units.models import SchoolUnit

from .seed_phase2_demo import ADMIN_USERNAME, UNIT_SLUG


User = get_user_model()


class Command(BaseCommand):
    help = (
        "Delete exactly the fixture seed_phase2_demo creates. Safe to run "
        "even when nothing was seeded (e.g. a fresh database) — the "
        "real-Django E2E lane always calls this in a finally block."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        units_queryset = SchoolUnit.objects.filter(slug=UNIT_SLUG)
        users_queryset = User.objects.filter(username=ADMIN_USERNAME)
        # Count before delete(), whose return value also includes
        # cascade-deleted related rows (e.g. UserProfile) — not what we want to report.
        units_deleted = units_queryset.count()
        users_deleted = users_queryset.count()
        units_queryset.delete()
        users_queryset.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"phase2 demo cleanup complete: units_deleted={units_deleted}, "
                f"users_deleted={users_deleted}"
            )
        )
