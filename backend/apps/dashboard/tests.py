from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.announcements.models import Announcement
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.units.models import SchoolUnit


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