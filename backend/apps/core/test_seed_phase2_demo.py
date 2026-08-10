import os
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.accounts.models import UserProfile
from apps.units.models import SchoolUnit


User = get_user_model()

ENV_VAR = "BESAT_TEST_PHASE2_ADMIN_PASSWORD"
UNIT_SLUG = "phase2-demo-unit"
ADMIN_USERNAME = "phase2-e2e-admin"


class SeedPhase2DemoCommandTests(TestCase):
    def setUp(self):
        os.environ[ENV_VAR] = "Str0ng!Phase2Password"
        self.addCleanup(os.environ.pop, ENV_VAR, None)

    def test_command_requires_password_env_to_be_set(self):
        os.environ.pop(ENV_VAR, None)

        with self.assertRaises(CommandError):
            call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        self.assertFalse(SchoolUnit.objects.filter(slug=UNIT_SLUG).exists())
        self.assertFalse(User.objects.filter(username=ADMIN_USERNAME).exists())

    def test_command_requires_password_env_to_be_non_empty(self):
        os.environ[ENV_VAR] = ""

        with self.assertRaises(CommandError):
            call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

    def test_command_creates_minimum_fixture_and_is_idempotent(self):
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        unit = SchoolUnit.objects.get(slug=UNIT_SLUG)
        self.assertIn("phase2-demo", unit.slug)
        self.assertTrue(unit.is_active)

        user = User.objects.get(username=ADMIN_USERNAME)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("Str0ng!Phase2Password"))

        profile, _ = UserProfile.objects.get_or_create(user=user)
        self.assertEqual(profile.role, UserProfile.Role.GENERAL_MANAGER)
        self.assertTrue(profile.is_active)

        second_output = StringIO()
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=second_output)

        self.assertEqual(SchoolUnit.objects.filter(slug=UNIT_SLUG).count(), 1)
        self.assertEqual(User.objects.filter(username=ADMIN_USERNAME).count(), 1)
        self.assertIn("unit_created=False", second_output.getvalue())
        self.assertIn("user_created=False", second_output.getvalue())

    def test_rerun_resyncs_password_to_current_env_value(self):
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        os.environ[ENV_VAR] = "AnotherStr0ng!Password"
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        user = User.objects.get(username=ADMIN_USERNAME)
        self.assertTrue(user.check_password("AnotherStr0ng!Password"))
        self.assertFalse(user.check_password("Str0ng!Phase2Password"))


class CleanupPhase2DemoCommandTests(TestCase):
    def test_cleanup_removes_exactly_the_seeded_fixture(self):
        os.environ[ENV_VAR] = "Str0ng!Phase2Password"
        self.addCleanup(os.environ.pop, ENV_VAR, None)
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        other_unit = SchoolUnit.objects.create(
            title="واحد دیگر",
            slug="some-other-unit",
            is_active=True,
        )

        call_command("cleanup_phase2_demo", stdout=StringIO())

        self.assertFalse(SchoolUnit.objects.filter(slug=UNIT_SLUG).exists())
        self.assertFalse(User.objects.filter(username=ADMIN_USERNAME).exists())
        self.assertTrue(SchoolUnit.objects.filter(pk=other_unit.pk).exists())

    def test_cleanup_is_safe_on_an_already_clean_database(self):
        output = StringIO()
        call_command("cleanup_phase2_demo", stdout=output)

        self.assertIn("units_deleted=0", output.getvalue())
        self.assertIn("users_deleted=0", output.getvalue())
        self.assertFalse(SchoolUnit.objects.filter(slug=UNIT_SLUG).exists())

    def test_cleanup_run_twice_in_a_row_does_not_error(self):
        os.environ[ENV_VAR] = "Str0ng!Phase2Password"
        self.addCleanup(os.environ.pop, ENV_VAR, None)
        call_command("seed_phase2_demo", "--password-env", ENV_VAR, stdout=StringIO())

        call_command("cleanup_phase2_demo", stdout=StringIO())
        call_command("cleanup_phase2_demo", stdout=StringIO())

        self.assertFalse(SchoolUnit.objects.filter(slug=UNIT_SLUG).exists())
