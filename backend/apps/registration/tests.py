from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

from apps.registration.models import RegistrationInfo, RegistrationRequest


User = get_user_model()


class RegistrationPublicAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def test_registration_info_returns_empty_payload_when_no_active_info_exists(self):
        response = self.client.get("/api/registration/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "پیش‌ثبت‌نام")
        self.assertFalse(response.data["is_open"])
        self.assertEqual(response.data["required_documents"], [])

    def test_registration_info_returns_active_info(self):
        RegistrationInfo.objects.create(
            title="ثبت‌نام سال تحصیلی",
            description="توضیحات ثبت‌نام",
            is_open=True,
            open_message="ثبت‌نام باز است.",
            required_documents=["شناسنامه", "کارت ملی ولی"],
            is_active=True,
        )

        response = self.client.get("/api/registration/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "ثبت‌نام سال تحصیلی")
        self.assertTrue(response.data["is_open"])
        self.assertEqual(response.data["required_documents"], ["شناسنامه", "کارت ملی ولی"])

    def test_can_create_registration_request_when_registration_is_open(self):
        RegistrationInfo.objects.create(
            title="ثبت‌نام",
            is_open=True,
            is_active=True,
        )

        payload = {
            "student_full_name": "محمد رضایی",
            "parent_full_name": "علی رضایی",
            "parent_phone": "09120000000",
            "parent_email": "parent@example.com",
            "requested_unit": self.unit.id,
            "requested_grade": "اول",
            "description": "توضیح تست",
        }

        response = self.client.post("/api/registration-requests/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(RegistrationRequest.objects.count(), 1)
        self.assertEqual(response.data["message"], "درخواست پیش‌ثبت‌نام با موفقیت ثبت شد.")

    def test_cannot_create_registration_request_when_registration_is_closed(self):
        RegistrationInfo.objects.create(
            title="ثبت‌نام",
            is_open=False,
            closed_message="ثبت‌نام بسته است.",
            is_active=True,
        )

        payload = {
            "student_full_name": "محمد رضایی",
            "parent_full_name": "علی رضایی",
            "parent_phone": "09120000000",
            "requested_unit": self.unit.id,
        }

        response = self.client.post("/api/registration-requests/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("registration", response.data)
        self.assertEqual(RegistrationRequest.objects.count(), 0)

    def test_registration_request_requires_required_fields(self):
        response = self.client.post("/api/registration-requests/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("student_full_name", response.data)
        self.assertIn("parent_phone", response.data)
        self.assertIn("requested_unit", response.data)

    def test_registration_request_rejects_inactive_unit(self):
        RegistrationInfo.objects.create(
            title="ثبت‌نام",
            is_open=True,
            is_active=True,
        )

        inactive_unit = SchoolUnit.objects.create(
            title="واحد غیرفعال",
            slug="inactive-unit",
            is_active=False,
        )

        payload = {
            "student_full_name": "محمد رضایی",
            "parent_full_name": "علی رضایی",
            "parent_phone": "09120000000",
            "requested_unit": inactive_unit.id,
        }

        response = self.client.post("/api/registration-requests/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("requested_unit", response.data)


class RegistrationCMSAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit_1 = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.unit_2 = SchoolUnit.objects.create(
            title="متوسطه",
            slug="middle-school",
            is_active=True,
        )

        self.general_manager = self.create_user(
            username="general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )

        self.unit_manager = self.create_user(
            username="unitmanager",
            role=UserProfile.Role.UNIT_MANAGER,
        )

        self.parent = self.create_user(
            username="parent",
            role=UserProfile.Role.PARENT,
        )

        UserUnitMembership.objects.create(
            user=self.unit_manager,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        self.request_1 = RegistrationRequest.objects.create(
            student_full_name="دانش‌آموز اول",
            parent_full_name="ولی اول",
            parent_phone="09120000001",
            requested_unit=self.unit_1,
            requested_grade="اول",
        )

        self.request_2 = RegistrationRequest.objects.create(
            student_full_name="دانش‌آموز دوم",
            parent_full_name="ولی دوم",
            parent_phone="09120000002",
            requested_unit=self.unit_2,
            requested_grade="هفتم",
        )

    def create_user(self, username, role):
        user = User.objects.create_user(
            username=username,
            password="password123",
            email=f"{username}@example.com",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.save()

        return user

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_general_manager_can_list_all_registration_requests(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/registration-requests/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

    def test_unit_manager_can_list_only_own_unit_registration_requests(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/registration-requests/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.request_1.id)

    def test_parent_cannot_list_registration_requests(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/registration-requests/")

        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_list_registration_requests(self):
        response = self.client.get("/api/cms/registration-requests/")

        self.assertEqual(response.status_code, 401)

    def test_general_manager_can_retrieve_registration_request(self):
        self.authenticate(self.general_manager)

        response = self.client.get(f"/api/cms/registration-requests/{self.request_1.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["student_full_name"], "دانش‌آموز اول")

    def test_unit_manager_cannot_retrieve_other_unit_registration_request(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(f"/api/cms/registration-requests/{self.request_2.id}/")

        self.assertEqual(response.status_code, 404)

    def test_general_manager_can_update_registration_request_status(self):
        self.authenticate(self.general_manager)

        response = self.client.patch(
            f"/api/cms/registration-requests/{self.request_1.id}/",
            {
                "status": RegistrationRequest.Status.CONTACTED,
                "admin_note": "تماس گرفته شد",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.request_1.refresh_from_db()
        self.assertEqual(self.request_1.status, RegistrationRequest.Status.CONTACTED)
        self.assertEqual(self.request_1.admin_note, "تماس گرفته شد")

    def test_unit_manager_can_update_own_unit_registration_request_status(self):
        self.authenticate(self.unit_manager)

        response = self.client.patch(
            f"/api/cms/registration-requests/{self.request_1.id}/",
            {
                "status": RegistrationRequest.Status.REVIEWING,
                "admin_note": "در حال بررسی",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.request_1.refresh_from_db()
        self.assertEqual(self.request_1.status, RegistrationRequest.Status.REVIEWING)
        self.assertEqual(self.request_1.admin_note, "در حال بررسی")
