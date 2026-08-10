from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile
from apps.departments.models import Department


User = get_user_model()


class DepartmentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.active_department = Department.objects.create(
            title="دپارتمان علوم",
            slug="science",
            short_description="توضیح کوتاه علوم",
            description="توضیحات کامل دپارتمان علوم",
            order=1,
            is_active=True,
        )

        self.inactive_department = Department.objects.create(
            title="دپارتمان غیرفعال",
            slug="inactive-department",
            order=2,
            is_active=False,
        )

    def test_departments_list_returns_only_active_departments(self):
        response = self.client.get("/api/departments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "دپارتمان علوم")
        self.assertEqual(response.data[0]["slug"], "science")

    def test_department_detail_by_slug(self):
        response = self.client.get("/api/departments/science/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "دپارتمان علوم")
        self.assertEqual(response.data["slug"], "science")

    def test_inactive_department_detail_returns_404(self):
        response = self.client.get("/api/departments/inactive-department/")

        self.assertEqual(response.status_code, 404)

    def test_departments_search(self):
        response = self.client.get("/api/departments/?search=علوم")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["slug"], "science")


class RetiredDepartmentFilterTests(TestCase):
    """معاونت آموزشی / معاونت فرهنگی / باشگاه المپیاد must not appear in the
    public departments wheel or virtual tour, but stay visible/manageable
    through the CMS for a general manager."""

    def setUp(self):
        self.client = APIClient()

        self.retired_exact = Department.objects.create(
            title="معاونت آموزشی",
            slug="deputy-education",
            order=1,
            is_active=True,
        )
        # Whitespace/ZWNJ/Arabic-letter variance a normalized-title filter
        # must still catch.
        self.retired_variant = Department.objects.create(
            title="معاونت  فرهنگي‌",
            slug="deputy-culture",
            order=2,
            is_active=True,
        )
        self.retired_third = Department.objects.create(
            title="باشگاه المپیاد",
            slug="olympiad-club",
            order=3,
            is_active=True,
        )
        self.kept_department = Department.objects.create(
            title="دپارتمان علوم",
            slug="science-dep",
            order=4,
            is_active=True,
        )

        self.general_manager = User.objects.create_user(
            username="gm",
            password="password123",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.general_manager)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()

    def test_public_list_excludes_retired_departments(self):
        response = self.client.get("/api/departments/")

        self.assertEqual(response.status_code, 200)
        slugs = {item["slug"] for item in response.data}
        self.assertEqual(slugs, {"science-dep"})

    def test_public_detail_of_retired_department_is_not_found(self):
        response = self.client.get("/api/departments/deputy-education/")

        self.assertEqual(response.status_code, 404)

    def test_cms_list_still_includes_retired_departments_for_general_manager(self):
        self.client.force_authenticate(user=self.general_manager)

        response = self.client.get("/api/cms/departments/")

        self.assertEqual(response.status_code, 200)
        slugs = {item["slug"] for item in response.data["results"]}
        self.assertEqual(
            slugs,
            {"deputy-education", "deputy-culture", "olympiad-club", "science-dep"},
        )