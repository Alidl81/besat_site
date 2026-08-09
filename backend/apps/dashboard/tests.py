from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.announcements.models import Announcement
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.units.models import SchoolUnit

from .models import InternalMessage, Student


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

    def test_general_manager_dashboard_matches_frontend_contract(self):
        InternalMessage.objects.create(
            sender=self.unit_manager,
            recipient=self.general_manager,
            sender_name="Unit Manager",
            sender_role=UserProfile.Role.UNIT_MANAGER,
            recipient_name="General Manager",
            recipient_role=UserProfile.Role.GENERAL_MANAGER,
            subject="Dashboard message",
            body="Visible in the admin dashboard feed.",
            is_read=False,
            unit=self.unit_1,
        )
        self.authenticate(self.general_manager)

        response = self.client.get("/api/dashboard/general-manager/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["metrics"]), 4)
        self.assertEqual(
            set(response.data["metrics"][0]),
            {"key", "title", "value", "detail", "trend", "tone", "icon"},
        )
        self.assertEqual(response.data["messages"][0]["title"], "Dashboard message")
        self.assertEqual(len(response.data["units"]), 2)
        self.assertEqual(
            set(response.data["units"][0]),
            {
                "id",
                "title",
                "students_count",
                "staff_count",
                "new_registrations_count",
                "published_content_count",
                "is_active",
            },
        )
        self.assertIn("events", response.data)
        self.assertIn("announcements", response.data)
        self.assertIn("current_date", response.data)

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

    def test_unit_manager_context_matches_frontend_contract(self):
        profile = self.unit_manager.profile
        profile.full_name = "Unit Manager"
        profile.save(update_fields=("full_name",))
        InternalMessage.objects.create(
            sender=self.general_manager,
            recipient=self.unit_manager,
            sender_name="General Manager",
            sender_role=UserProfile.Role.GENERAL_MANAGER,
            recipient_name="Unit Manager",
            recipient_role=UserProfile.Role.UNIT_MANAGER,
            subject="Unread message",
            body="Dashboard context must include this message.",
            is_read=False,
            unit=self.unit_1,
        )
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/context/?unit={self.unit_1.id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "user": {
                    "id": self.unit_manager.id,
                    "full_name": "Unit Manager",
                    "role_display": UserProfile.Role.UNIT_MANAGER.label,
                    "avatar_url": None,
                },
                "academic_years": [],
                "selected_academic_year_id": None,
                "units": [
                    {
                        "id": self.unit_1.id,
                        "title": self.unit_1.title,
                    }
                ],
                "selected_unit_id": self.unit_1.id,
                "children": [],
                "selected_child_id": None,
                "unread_notifications": 0,
                "unread_messages": 1,
                "current_date": response.data["current_date"],
            },
        )

    def test_unit_manager_context_rejects_an_inaccessible_unit(self):
        self.authenticate(self.unit_manager)

        response = self.client.get(
            f"/api/dashboard/context/?unit={self.unit_2.id}"
        )

        self.assertEqual(response.status_code, 403)

    def test_student_list_and_summary_match_frontend_contract(self):
        student = Student.objects.create(
            full_name="Frontend Student",
            national_code="1234567890",
            unit=self.unit_1,
            class_title="Class 101",
            parent=self.parent,
        )
        self.authenticate(self.general_manager)

        list_response = self.client.get("/api/cms/students/")
        summary_response = self.client.get("/api/cms/students/summary/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(summary_response.status_code, 200)
        item = list_response.data["results"][0]
        self.assertEqual(item["id"], student.id)
        self.assertEqual(item["unit"], {"id": self.unit_1.id, "title": self.unit_1.title})
        self.assertIsNone(item["student_code"])
        self.assertIsNone(item["grade"])
        self.assertEqual(item["class_room"], {"id": "Class 101", "title": "Class 101"})
        self.assertEqual(item["guardian"]["full_name"], self.parent.username)
        self.assertEqual(item["profile_status"], "complete")
        self.assertIsNone(item["education_status"])
        self.assertEqual(
            summary_response.data,
            {
                "total": 1,
                "completed_profiles": 1,
                "new_this_year": 1,
                "incomplete_profiles": 0,
            },
        )

    def test_student_list_filters_match_frontend_controls(self):
        complete = Student.objects.create(
            full_name="Searchable Complete Student",
            national_code="1111111111",
            unit=self.unit_1,
            class_title="Class A",
        )
        Student.objects.create(
            full_name="Incomplete Student",
            unit=self.unit_2,
        )
        self.authenticate(self.general_manager)

        response = self.client.get(
            f"/api/cms/students/?search=Searchable&unit={self.unit_1.id}&profile_status=complete"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], complete.id)

        incomplete_response = self.client.get(
            "/api/cms/students/?profile_status=incomplete"
        )
        self.assertEqual(incomplete_response.status_code, 200)
        self.assertEqual(incomplete_response.data["count"], 1)

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
