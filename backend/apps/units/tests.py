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

        self.internal_unit = SchoolUnit.objects.create(
            title="واحد آزمایشی حساب‌های توسعه",
            slug="dev-accounts-unit",
            order=998,
            is_active=True,
            is_internal=True,
        )

    def test_units_list_returns_only_active_units(self):
        response = self.client.get("/api/units/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "دبستان")
        self.assertEqual(response.data[0]["slug"], "primary-school")

    def test_units_list_excludes_internal_units_even_when_active(self):
        response = self.client.get("/api/units/")

        self.assertEqual(response.status_code, 200)
        slugs = [unit["slug"] for unit in response.data]
        self.assertNotIn("dev-accounts-unit", slugs)

    def test_internal_unit_detail_returns_404(self):
        response = self.client.get("/api/units/dev-accounts-unit/")

        self.assertEqual(response.status_code, 404)

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


class SchoolUnitRealQuerySetTests(TestCase):
    """`.real()` is the central abstraction every normal unit selector,
    filter, count, and report must use so internal/dev plumbing units never
    leak into product-facing surfaces -- while the unfiltered manager stays
    available for genuine admin CRUD and internal membership resolution."""

    def setUp(self):
        self.active_unit = SchoolUnit.objects.create(
            title="دبستان", slug="primary-school", order=1, is_active=True,
        )
        self.inactive_unit = SchoolUnit.objects.create(
            title="واحد غیرفعال", slug="inactive-unit", order=2, is_active=False,
        )
        self.internal_unit = SchoolUnit.objects.create(
            title="واحد آزمایشی حساب‌های توسعه",
            slug="dev-accounts-unit",
            order=998,
            is_active=True,
            is_internal=True,
        )

    def test_real_excludes_internal_units(self):
        slugs = list(SchoolUnit.objects.real().values_list("slug", flat=True))

        self.assertIn("primary-school", slugs)
        self.assertNotIn("dev-accounts-unit", slugs)

    def test_real_excludes_inactive_units(self):
        slugs = list(SchoolUnit.objects.real().values_list("slug", flat=True))

        self.assertNotIn("inactive-unit", slugs)

    def test_unfiltered_manager_still_returns_internal_units_for_admin_use(self):
        # Genuine admin CRUD (the Units management table) and internal
        # membership resolution must keep full visibility.
        slugs = list(SchoolUnit.objects.all().values_list("slug", flat=True))

        self.assertIn("dev-accounts-unit", slugs)


class CMSSchoolUnitAdminVisibilityTests(TestCase):
    """The CMS Units management endpoint is genuine full-visibility admin
    CRUD -- a general manager must still see and manage the internal unit
    there, unlike normal product selectors."""

    def setUp(self):
        from django.contrib.auth import get_user_model

        from apps.accounts.models import UserProfile

        self.client = APIClient()
        self.internal_unit = SchoolUnit.objects.create(
            title="واحد آزمایشی حساب‌های توسعه",
            slug="dev-accounts-unit",
            order=998,
            is_active=True,
            is_internal=True,
        )
        User = get_user_model()
        self.general_manager = User.objects.create_user(username="gm", password="x")
        UserProfile.objects.filter(user=self.general_manager).update(
            role=UserProfile.Role.GENERAL_MANAGER,
        )

    def test_general_manager_sees_internal_unit_in_cms_units_endpoint(self):
        self.client.force_authenticate(self.general_manager)

        response = self.client.get("/api/cms/units/")

        self.assertEqual(response.status_code, 200)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        slugs = [unit["slug"] for unit in results]
        self.assertIn("dev-accounts-unit", slugs)

    def test_cms_units_endpoint_exposes_is_internal_flag(self):
        self.client.force_authenticate(self.general_manager)

        response = self.client.get("/api/cms/units/")

        self.assertEqual(response.status_code, 200)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        internal_entry = next(unit for unit in results if unit["slug"] == "dev-accounts-unit")
        self.assertTrue(internal_entry["is_internal"])