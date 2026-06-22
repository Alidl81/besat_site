from django.test import TestCase
from rest_framework.test import APIClient

from apps.site_settings.models import SiteSettings



class SiteSettingsAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_site_settings_returns_empty_payload_when_no_active_record_exists(self):
        response = self.client.get("/api/site-settings/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["school_name"])
        self.assertIsNone(response.data["logo"])
        self.assertIsNone(response.data["hero_title"])
        self.assertIsNone(response.data["phone_primary"])

    def test_site_settings_returns_active_record(self):
        SiteSettings.objects.create(
            school_name="مدرسه بعثت",
            short_name="بعثت",
            slogan="شعار مدرسه",
            is_active=True,
        )

        response = self.client.get("/api/site-settings/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["school_name"], "مدرسه بعثت")
        self.assertEqual(response.data["short_name"], "بعثت")
        self.assertEqual(response.data["slogan"], "شعار مدرسه")

    def test_only_one_site_settings_can_remain_active(self):
        first = SiteSettings.objects.create(
            school_name="نسخه اول",
            is_active=True,
        )

        second = SiteSettings.objects.create(
            school_name="نسخه دوم",
            is_active=True,
        )

        first.refresh_from_db()
        second.refresh_from_db()

        self.assertFalse(first.is_active)
        self.assertTrue(second.is_active)

        response = self.client.get("/api/site-settings/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["school_name"], "نسخه دوم")