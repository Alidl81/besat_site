from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.announcements.models import Announcement
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.registration.models import RegistrationRequest
from apps.units.models import SchoolUnit

from .models import Program, Student

User = get_user_model()


class DashboardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit_1 = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
            order=1,
        )

        self.unit_2 = SchoolUnit.objects.create(
            title="متوسطه",
            slug="middle-school",
            is_active=True,
            order=2,
        )

        self.general_manager = self.create_user(
            username="general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )

        self.unit_manager = self.create_user(
            username="unitmanager",
            role=UserProfile.Role.UNIT_MANAGER,
        )

        self.unit_media = self.create_user(
            username="unitmedia",
            role=UserProfile.Role.UNIT_MEDIA,
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

        UserUnitMembership.objects.create(
            user=self.unit_media,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )

        UserUnitMembership.objects.create(
            user=self.parent,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.PARENT,
            is_active=True,
        )
        self.student = Student.objects.create(
            full_name="فرزند والد",
            national_code="1234567890",
            unit=self.unit_1,
            class_title="اول الف",
            parent=self.parent,
        )
        Program.objects.create(
            title="برنامه واحد",
            unit=self.unit_1,
            date="2026-08-02T08:00:00Z",
        )

        News.objects.create(
            title="خبر دبستان",
            slug="unit-1-news",
            summary="خلاصه",
            scope=News.Scope.UNIT,
            unit=self.unit_1,
            status=News.Status.WAITING_REVIEW,
            is_active=True,
        )

        News.objects.create(
            title="خبر متوسطه",
            slug="unit-2-news",
            summary="خلاصه",
            scope=News.Scope.UNIT,
            unit=self.unit_2,
            status=News.Status.WAITING_REVIEW,
            is_active=True,
        )

        Announcement.objects.create(
            title="اطلاعیه دبستان",
            slug="unit-1-announcement",
            summary="خلاصه",
            scope=Announcement.Scope.UNIT,
            unit=self.unit_1,
            status=Announcement.Status.DRAFT,
            is_active=True,
        )

        GalleryItem.objects.create(
            title="گالری دبستان",
            slug="unit-1-gallery",
            summary="خلاصه",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit_1,
            status=GalleryItem.Status.DRAFT,
            is_active=True,
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

    def test_general_manager_can_access_general_dashboard(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.GENERAL_MANAGER)
        self.assertEqual(response.data["scope"], "all")
        self.assertIn("stats", response.data)
        self.assertIn("cards", response.data)
        self.assertGreaterEqual(response.data["stats"]["content_total"], 4)

    def test_panel_context_is_scoped_to_the_authenticated_user(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/context/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["selected_unit_id"], self.unit_1.id)
        self.assertEqual(response.data["units"], [
            {"id": self.unit_1.id, "title": self.unit_1.title},
        ])
        self.assertEqual(response.data["children"], [])
        self.assertEqual(response.data["unread_notifications"], 1)

    def test_panel_context_rejects_an_inaccessible_unit(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/context/?unit={self.unit_2.id}"
        )

        self.assertEqual(response.status_code, 403)

    def test_panel_context_requires_authentication(self):
        response = self.client.get("/api/dashboard/context/")

        self.assertEqual(response.status_code, 401)

    def test_parent_cannot_access_general_dashboard(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_access_own_unit_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/unit-manager/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.UNIT_MANAGER)
        self.assertEqual(response.data["selected_unit"]["id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["unit_id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["news_total"], 1)
        self.assertEqual(response.data["stats"]["announcements_total"], 1)
        self.assertEqual(response.data["stats"]["gallery_total"], 1)

    def test_unit_manager_cannot_access_other_unit_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/unit-manager/?unit_id={self.unit_2.id}"
        )

        self.assertEqual(response.status_code, 403)

    def test_unit_media_can_access_media_dashboard(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/dashboard/media/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.UNIT_MEDIA)
        self.assertEqual(response.data["selected_unit"]["id"], self.unit_1.id)
        self.assertEqual(response.data["stats"]["gallery_total"], 1)

    def test_unit_media_cannot_access_unit_manager_dashboard(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/dashboard/unit-manager/")

        self.assertEqual(response.status_code, 403)

    def test_parent_can_access_parent_dashboard(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/dashboard/parents/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.PARENT)
        self.assertIn("profile", response.data)
        self.assertEqual(response.data["stats"]["accessible_units_count"], 1)

    def test_unit_manager_cannot_access_parent_dashboard(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/dashboard/parents/")

        self.assertEqual(response.status_code, 403)

    def test_anonymous_user_cannot_access_dashboard(self):
        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 401)

    def test_student_summary_is_registered_and_scoped(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/students/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["completed_profiles"], 1)

    def test_parent_records_are_registered_and_scoped_to_the_parent(self):
        self.authenticate(self.parent)

        children = self.client.get("/api/parents/children/")
        detail = self.client.get(f"/api/parents/children/{self.student.id}/")
        programs = self.client.get("/api/parents/programs/")

        self.assertEqual(children.status_code, 200)
        self.assertEqual(children.data[0]["id"], self.student.id)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["id"], self.student.id)
        self.assertEqual(programs.status_code, 200)
        self.assertEqual(programs.data["count"], 1)

    def test_parent_registrations_are_scoped_by_account_not_contact_details(self):
        owned = RegistrationRequest.objects.create(
            student_full_name="فرزند ثبت‌شده",
            parent_phone="09120000000",
            requested_unit=self.unit_1,
            submitted_by=self.parent,
        )
        RegistrationRequest.objects.create(
            student_full_name="درخواست هم‌نام",
            parent_phone="09120000000",
            requested_unit=self.unit_1,
            submitted_by=self.general_manager,
        )
        self.authenticate(self.parent)

        response = self.client.get("/api/parents/registrations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [owned.id])

    def test_reports_are_registered_and_require_general_manager(self):
        self.authenticate(self.general_manager)
        allowed = self.client.get("/api/cms/reports/overview/")

        self.authenticate(self.unit_manager)
        denied = self.client.get("/api/cms/reports/overview/")

        self.assertEqual(allowed.status_code, 200)
        self.assertIn("metrics", allowed.data)
        self.assertEqual(denied.status_code, 403)
