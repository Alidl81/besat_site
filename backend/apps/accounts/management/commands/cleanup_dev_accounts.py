from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.units.models import SchoolUnit

from .seed_dev_accounts import ACCOUNTS, DEV_UNIT_SLUG

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Delete exactly the fixture seed_dev_accounts.py creates. "
        "DEVELOPMENT ONLY. Safe to run even when nothing was seeded."
    )

    def handle(self, *args, **options):
        usernames = [account["username"] for account in ACCOUNTS]
        users_deleted, _ = User.objects.filter(username__in=usernames).delete()
        units_deleted, _ = SchoolUnit.objects.filter(slug=DEV_UNIT_SLUG).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Dev accounts cleanup complete: users_deleted={users_deleted}, "
                f"units_deleted={units_deleted}"
            )
        )
