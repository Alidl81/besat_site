import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import UserProfile
from apps.accounts.serializers import revoke_all_outstanding_tokens
from config.settings._production_guard import is_placeholder_value


class Command(BaseCommand):
    help = "Create or update the CMS administrator from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("CMS_ADMIN_USERNAME", "").strip()
        password = os.getenv("CMS_ADMIN_PASSWORD", "")
        email = os.getenv("CMS_ADMIN_EMAIL", "").strip()
        full_name = os.getenv("CMS_ADMIN_FULL_NAME", "مدیر سامانه").strip()
        # Deliberately opt-in and separate from CMS_ADMIN_PASSWORD itself:
        # a redeploy commonly re-supplies the same env vars it was already
        # running with (secrets manager, compose env_file, ...), so
        # "password is set" can't be the signal for "operator wants a
        # reset" -- that would silently overwrite a password an admin
        # changed by hand through the UI on every routine restart.
        force_reset = os.getenv("CMS_ADMIN_FORCE_RESET", "").strip().lower() in ("1", "true", "yes")

        if not username and not password:
            self.stdout.write("CMS admin bootstrap skipped (credentials not set).")
            return
        if not username or not password:
            raise CommandError(
                "CMS_ADMIN_USERNAME and CMS_ADMIN_PASSWORD must be set together."
            )
        if not settings.DEBUG and is_placeholder_value(password):
            raise CommandError(
                "CMS_ADMIN_PASSWORD looks like a placeholder value copied "
                "from an example env file -- refusing to bootstrap a "
                "production administrator account with it. Set a real, "
                "unique password."
            )

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )

        # Always keep role/staff/active flags correct -- those are cheap,
        # idempotent, and never destructive. The password itself is the
        # one field that must NOT be silently reapplied to an existing
        # account outside of local development or an explicit operator
        # request (settings.DEBUG covers the former; CMS_ADMIN_FORCE_RESET
        # covers the latter -- see the comment above).
        should_set_password = created or settings.DEBUG or force_reset
        if should_set_password:
            validate_password(password, user=user)
            user.set_password(password)
            if not created:
                # AUTH-001-FORCE-RESET-RACE: this is exactly the "recover
                # a compromised admin account" scenario -- an existing
                # account's password is being deliberately reset
                # (settings.DEBUG or an explicit CMS_ADMIN_FORCE_RESET=1).
                # A session an attacker already holds must not survive
                # that reset any more than a self-service password change
                # should let one survive -- but revoke_all_outstanding_
                # tokens()'s own docstring is explicit that it is NOT
                # race-safe on its own: every other caller
                # (ChangePasswordSerializer.save()/SetPasswordSerializer.
                # save()) wraps it in transaction.atomic() with a
                # UserProfile.select_for_update() row lock first, forcing
                # a concurrent /api/auth/refresh/ (which takes the
                # identical lock in RefreshTokenSerializer.validate()) to
                # serialize against it -- this command was the one caller
                # that skipped that lock, so a token refreshed in the gap
                # between the snapshot and the blacklist insert rotated
                # into a fresh, never-blacklisted descendant that outlived
                # the reset. Same lock, same pattern, here too.
                with transaction.atomic():
                    UserProfile.objects.select_for_update().filter(user=user).first()
                    revoke_all_outstanding_tokens(user)

        user.email = email or user.email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.full_name = full_name or profile.full_name
        profile.is_active = True
        profile.save()

        if created:
            action = "created"
        elif should_set_password:
            action = "updated (including password)"
        else:
            action = "left unchanged (already exists; password reset skipped -- set CMS_ADMIN_FORCE_RESET=1 to force it)"
        self.stdout.write(self.style.SUCCESS(f"CMS administrator {action}."))
