import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import UserProfile


class Command(BaseCommand):
    help = "Create or update the CMS administrator from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("CMS_ADMIN_USERNAME", "").strip()
        password = os.getenv("CMS_ADMIN_PASSWORD", "")
        email = os.getenv("CMS_ADMIN_EMAIL", "").strip()
        full_name = os.getenv("CMS_ADMIN_FULL_NAME", "مدیر سامانه").strip()

        if not username and not password:
            self.stdout.write("CMS admin bootstrap skipped (credentials not set).")
            return
        if not username or not password:
            raise CommandError(
                "CMS_ADMIN_USERNAME and CMS_ADMIN_PASSWORD must be set together."
            )

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )

        validate_password(password, user=user)
        user.email = email or user.email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.full_name = full_name or profile.full_name
        profile.is_active = True
        profile.save()

        action = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"CMS administrator {action}."))
