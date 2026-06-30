from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.about.models import AboutPage


class AboutPublicAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_about_returns_empty_payload_when_no_active_page_exists(self):
        response = self.client.get("/api/about/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["title"])
        self.assertIsNone(response.data["description"])
        self.assertIsNone(response.data["image"])
        self.assertIsNone(response.data["meta_description"])

    def test_about_returns_active_page(self):
        AboutPage.objects.create(
            title="درباره مدرسه بعثت",
            description="معرفی رسمی مدرسه",
            meta_description="درباره مدرسه",
            is_active=True,
        )

        response = self.client.get("/api/about/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "درباره مدرسه بعثت")
        self.assertEqual(response.data["description"], "معرفی رسمی مدرسه")
        self.assertEqual(response.data["meta_description"], "درباره مدرسه")

    def test_about_ignores_inactive_page(self):
        AboutPage.objects.create(
            title="غیرفعال",
            description="این نباید نمایش داده شود.",
            is_active=False,
        )

        response = self.client.get("/api/about/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["title"])

    def test_only_one_about_page_can_be_active(self):
        AboutPage.objects.create(
            title="فعال اول",
            description="متن اول",
            is_active=True,
        )

        second_page = AboutPage(
            title="فعال دوم",
            description="متن دوم",
            is_active=True,
        )

        with self.assertRaises(ValidationError):
            second_page.full_clean()