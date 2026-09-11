import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

User = get_user_model()

# Markers matched exactly by cleanup_dev_accounts.py -- keep both files in sync.
ACCOUNTS = (
    {
        "username": "dev_admin",
        "email": "dev-admin@example.invalid",
        "full_name": "مدیر آزمایشی توسعه",
        "role": UserProfile.Role.GENERAL_MANAGER,
        "password_env": "DEV_ADMIN_PASSWORD",
    },
    {
        "username": "dev_media",
        "email": "dev-media@example.invalid",
        "full_name": "مسئول رسانه آزمایشی توسعه",
        "role": UserProfile.Role.UNIT_MEDIA,
        "password_env": "DEV_MEDIA_PASSWORD",
    },
    {
        "username": "dev_unit_manager",
        "email": "dev-unit-manager@example.invalid",
        "full_name": "مدیر واحد آزمایشی توسعه",
        "role": UserProfile.Role.UNIT_MANAGER,
        "password_env": "DEV_UNIT_MANAGER_PASSWORD",
    },
    {
        "username": "dev_parent",
        "email": "dev-parent@example.invalid",
        "full_name": "والد آزمایشی توسعه",
        "role": UserProfile.Role.PARENT,
        "password_env": "DEV_PARENT_PASSWORD",
    },
)

DEV_UNIT_SLUG = "dev-accounts-unit"


class Command(BaseCommand):
    help = (
        "Seed development/testing accounts for the supported panel roles "
        "(general_manager, unit_manager, unit_media, parent). DEVELOPMENT ONLY -- reads "
        "passwords from environment variables (DEV_ADMIN_PASSWORD, "
        "DEV_MEDIA_PASSWORD, DEV_UNIT_MANAGER_PASSWORD, DEV_PARENT_PASSWORD) so nothing is hardcoded "
        "in source; refuses to run if any is unset. Never run this against "
        "a production database. Idempotent -- safe to rerun after a "
        "database reset (also resyncs the password to the current env "
        "value on rerun)."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "seed_dev_accounts is development-only and refuses to run "
                "when settings.DEBUG is False (i.e. under "
                "config.settings.production) -- this command exists to "
                "seed known-guessable-username test accounts, which must "
                "never be created against a production database."
            )

        passwords: dict[str, str] = {}
        for account in ACCOUNTS:
            value = os.environ.get(account["password_env"])
            if not value:
                raise CommandError(
                    f"Environment variable '{account['password_env']}' is not "
                    f"set or empty; refusing to create/update "
                    f"'{account['username']}' with a guessable password."
                )
            passwords[account["username"]] = value

        unit, unit_created = SchoolUnit.objects.get_or_create(
            slug=DEV_UNIT_SLUG,
            defaults={
                "title": "واحد آزمایشی حساب‌های توسعه",
                "kind": SchoolUnit.Kind.ELEMENTARY,
                "gender": SchoolUnit.Gender.MIXED,
                "is_active": True,
                "is_internal": True,
                "order": 998,
            },
        )

        if not unit.is_internal:
            unit.is_internal = True
            unit.save(update_fields=["is_internal"])

        created_summary = []
        for account in ACCOUNTS:
            user, user_created = User.objects.get_or_create(
                username=account["username"],
                defaults={"email": account["email"]},
            )
            user.email = account["email"]
            user.first_name = account["full_name"]
            user.set_password(passwords[account["username"]])
            user.is_active = True
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = account["role"]
            profile.full_name = account["full_name"]
            profile.is_active = True
            profile.save()

            if account["role"] in (UserProfile.Role.UNIT_MANAGER, UserProfile.Role.UNIT_MEDIA):
                UserUnitMembership.objects.get_or_create(
                    user=user,
                    unit=unit,
                    role=account["role"],
                    defaults={"is_active": True},
                )

            created_summary.append(f"{account['username']} (created={user_created})")

        self.stdout.write(
            self.style.SUCCESS(
                f"Dev accounts seed complete: unit_created={unit_created}; "
                + ", ".join(created_summary)
            )
        )
