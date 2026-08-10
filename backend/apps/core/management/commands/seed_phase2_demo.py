import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import UserProfile
from apps.units.models import SchoolUnit


User = get_user_model()

# Markers matched exactly by cleanup_phase2_demo.py — keep both files in sync.
UNIT_SLUG = "phase2-demo-unit"
ADMIN_USERNAME = "phase2-e2e-admin"


class Command(BaseCommand):
    help = (
        "Seed the minimal fixture the real-Django E2E lane "
        "(frontend/tests/e2e/real-django.spec.ts) exercises: one "
        "phase2-demo-slugged unit and one phase2-e2e-admin general manager "
        "account. Test-only; never auto-run outside the E2E harness."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password-env",
            required=True,
            help="Name of the environment variable holding the phase2-e2e-admin password.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password_env = options["password_env"]
        password = os.environ.get(password_env)

        if not password:
            raise CommandError(
                f"Environment variable '{password_env}' is not set or empty; "
                "refusing to create the phase2-e2e-admin account with a "
                "guessable or unusable password."
            )

        unit, unit_created = SchoolUnit.objects.get_or_create(
            slug=UNIT_SLUG,
            defaults={
                "title": "واحد آزمایشی فاز دو",
                "kind": SchoolUnit.Kind.ELEMENTARY,
                "gender": SchoolUnit.Gender.MIXED,
                "is_active": True,
                "order": 999,
            },
        )

        user, user_created = User.objects.get_or_create(
            username=ADMIN_USERNAME,
            defaults={"email": "phase2-e2e-admin@example.invalid"},
        )
        # Always resync the password to the current env value so a rerun
        # with a rotated secret still leaves the fixture usable.
        user.set_password(password)
        user.is_active = True
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"phase2 demo seed complete: unit_created={unit_created}, "
                f"user_created={user_created}"
            )
        )
