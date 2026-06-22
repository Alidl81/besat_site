from django.test import TestCase
from rest_framework.test import APIClient

from apps.departments.models import Department


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