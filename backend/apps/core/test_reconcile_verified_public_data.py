from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.about.models import AboutPage
from apps.contact.models import ContactInfo
from apps.site_settings.models import SiteSettings
from apps.units.models import SchoolUnit


class VerifiedPublicDataReconciliationTests(TestCase):
    def setUp(self):
        SiteSettings.objects.create(is_active=True)
        AboutPage.objects.create(is_active=True)
        SchoolUnit.objects.create(
            title="واحد ۱ و ۲",
            slug="boys-preschool-elementary-1-2",
            kind=SchoolUnit.Kind.ELEMENTARY,
            gender=SchoolUnit.Gender.BOYS,
            is_active=True,
        )
        SchoolUnit.objects.create(
            title="واحد ۳",
            slug="boys-elementary-3",
            kind=SchoolUnit.Kind.ELEMENTARY,
            gender=SchoolUnit.Gender.BOYS,
            is_active=True,
        )

    def test_dry_run_does_not_write_or_create_records(self):
        output = StringIO()

        call_command("reconcile_verified_public_data", stdout=output)

        self.assertIn("dry-run", output.getvalue())
        self.assertEqual(ContactInfo.objects.count(), 0)
        self.assertIsNone(SiteSettings.objects.get().address)
        self.assertIsNone(
            SchoolUnit.objects.get(slug="boys-preschool-elementary-1-2").address
        )

    def test_apply_is_field_level_and_idempotent(self):
        first_output = StringIO()
        call_command("reconcile_verified_public_data", "--apply", stdout=first_output)

        contact = ContactInfo.objects.get(is_active=True)
        settings = SiteSettings.objects.get(is_active=True)
        about = AboutPage.objects.get(is_active=True)
        unit = SchoolUnit.objects.get(slug="boys-preschool-elementary-1-2")

        self.assertEqual(contact.phone, "05138688881")
        self.assertEqual(contact.email, "info@besat.org")
        self.assertEqual(settings.phone_primary, "05138688881")
        self.assertEqual(about.founders[0]["name"], "محمدرضا صدیق‌پور")
        self.assertEqual(unit.address, "مشهد، نبش آزادی ۷")
        self.assertEqual(unit.phone, "36012090")
        self.assertEqual(ContactInfo.objects.filter(is_active=True).count(), 1)

        second_output = StringIO()
        call_command("reconcile_verified_public_data", "--apply", stdout=second_output)

        self.assertIn("0 field/record change(s)", second_output.getvalue())
        self.assertEqual(ContactInfo.objects.filter(is_active=True).count(), 1)
        self.assertEqual(SchoolUnit.objects.count(), 2)
        self.assertIn("OWNER_CONFIRMATION_REQUIRED", second_output.getvalue())
