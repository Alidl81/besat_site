from django.test import TestCase
from rest_framework.test import APIClient

from apps.units.models import SchoolUnit


class SchoolUnitAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.active_unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            subtitle="واحد دبستان",
            description="توضیحات دبستان",
            age_range="۷ تا ۱۲ سال",
            grade_range="اول تا ششم",
            order=1,
            is_active=True,
        )

        self.inactive_unit = SchoolUnit.objects.create(
            title="واحد غیرفعال",
            slug="inactive-unit",
            order=2,
            is_active=False,
        )

    def test_units_list_returns_only_active_units(self):
        response = self.client.get("/api/units/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "دبستان")
        self.assertEqual(response.data[0]["slug"], "primary-school")

    def test_units_list_contains_icon_field(self):
        response = self.client.get("/api/units/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("icon", response.data[0])

    def test_unit_detail_by_slug(self):
        response = self.client.get("/api/units/primary-school/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "دبستان")
        self.assertEqual(response.data["slug"], "primary-school")

    def test_unit_detail_by_id(self):
        response = self.client.get(f"/api/units/{self.active_unit.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.active_unit.id)
        self.assertEqual(response.data["slug"], "primary-school")

    def test_inactive_unit_detail_returns_404(self):
        response = self.client.get("/api/units/inactive-unit/")

        self.assertEqual(response.status_code, 404)

    def test_units_search(self):
        response = self.client.get("/api/units/?search=دبستان")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "دبستان")