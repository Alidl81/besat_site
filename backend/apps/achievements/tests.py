import shutil
import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile
from apps.units.models import SchoolUnit

from apps.achievements.models import Achievement


User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_test_image(name="achievement.webp", image_format="WEBP", content_type="image/webp"):
    image_file = BytesIO()
    image = Image.new("RGB", (100, 100), color="white")
    image.save(image_file, image_format)
    image_file.seek(0)

    return SimpleUploadedFile(
        name=name,
        content=image_file.read(),
        content_type=content_type,
    )


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AchievementPublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def create_achievement(
        self,
        title="افتخار تست",
        slug="test-achievement",
        is_active=True,
        is_featured=False,
        related_unit=None,
        achievement_date=None,
    ):
        if achievement_date is None:
            achievement_date = self.today

        return Achievement.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه افتخار",
            description="توضیحات افتخار",
            cover_image=make_test_image(name=f"{slug}.webp"),
            achievement_date=achievement_date,
            related_unit=related_unit,
            is_active=is_active,
            is_featured=is_featured,
        )

    def test_achievements_list_returns_only_active_items(self):
        active_achievement = self.create_achievement(
            title="افتخار فعال",
            slug="active-achievement",
        )

        self.create_achievement(
            title="افتخار غیرفعال",
            slug="inactive-achievement",
            is_active=False,
        )

        response = self.client.get("/api/achievements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], active_achievement.id)
        self.assertIn("cover_image", response.data["results"][0])
        self.assertIn("image", response.data["results"][0])

    def test_future_achievement_is_not_public(self):
        self.create_achievement(
            title="افتخار آینده",
            slug="future-achievement",
            achievement_date=self.today + timedelta(days=1),
        )

        response = self.client.get("/api/achievements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_achievement_detail_by_slug(self):
        self.create_achievement(
            title="افتخار جزئیات",
            slug="detail-achievement",
        )

        response = self.client.get("/api/achievements/detail-achievement/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "افتخار جزئیات")

    def test_inactive_achievement_detail_returns_404(self):
        self.create_achievement(
            title="افتخار غیرفعال",
            slug="inactive-detail-achievement",
            is_active=False,
        )

        response = self.client.get("/api/achievements/inactive-detail-achievement/")

        self.assertEqual(response.status_code, 404)

    def test_filter_featured_achievements(self):
        self.create_achievement(
            title="افتخار ویژه",
            slug="featured-achievement",
            is_featured=True,
        )

        self.create_achievement(
            title="افتخار معمولی",
            slug="normal-achievement",
            is_featured=False,
        )

        response = self.client.get("/api/achievements/?featured=true")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "featured-achievement")

    def test_filter_unit_achievements(self):
        self.create_achievement(
            title="افتخار واحد",
            slug="unit-achievement",
            related_unit=self.unit,
        )

        self.create_achievement(
            title="افتخار عمومی",
            slug="school-achievement",
            related_unit=None,
        )

        response = self.client.get(f"/api/achievements/?unit_id={self.unit.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["related_unit_id"], self.unit.id)


class AchievementModelValidationTests(TestCase):
    def setUp(self):
        self.inactive_unit = SchoolUnit.objects.create(
            title="واحد غیرفعال",
            slug="inactive-unit",
            is_active=False,
        )

    def test_active_achievement_cannot_use_inactive_unit(self):
        achievement = Achievement(
            title="افتخار نامعتبر",
            related_unit=self.inactive_unit,
            is_active=True,
        )

        with self.assertRaises(ValidationError):
            achievement.full_clean()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AchievementCMSAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.general_manager = self.create_user(
            username="general",
            role=UserProfile.Role.GENERAL_MANAGER,
        )

        self.parent = self.create_user(
            username="parent",
            role=UserProfile.Role.PARENT,
        )

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.achievement = Achievement.objects.create(
            title="افتخار CMS",
            slug="cms-achievement",
            summary="خلاصه",
            description="توضیحات",
            cover_image=make_test_image("cms-achievement.webp"),
            achievement_date=timezone.localdate(),
            related_unit=self.unit,
            is_active=True,
            is_featured=True,
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

    def test_general_manager_can_list_achievements(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/achievements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_parent_can_read_active_achievements_for_frontend(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/achievements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_anonymous_can_read_active_achievements_for_frontend(self):
        response = self.client.get("/api/cms/achievements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_general_manager_can_create_achievement(self):
        self.authenticate(self.general_manager)

        payload = {
            "title": "افتخار جدید",
            "summary": "خلاصه افتخار جدید",
            "description": "توضیحات افتخار جدید",
            "achievement_date": str(timezone.localdate()),
            "related_unit": self.unit.id,
            "is_active": True,
            "is_featured": False,
            "order": 2,
            "cover_image": make_test_image("new-achievement.webp"),
        }

        response = self.client.post(
            "/api/cms/achievements/",
            payload,
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Achievement.objects.count(), 2)

    def test_general_manager_can_update_achievement(self):
        self.authenticate(self.general_manager)

        response = self.client.patch(
            f"/api/cms/achievements/{self.achievement.id}/",
            {
                "title": "افتخار ویرایش‌شده",
                "is_featured": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.achievement.refresh_from_db()
        self.assertEqual(self.achievement.title, "افتخار ویرایش‌شده")
        self.assertFalse(self.achievement.is_featured)

    def test_general_manager_can_delete_achievement(self):
        self.authenticate(self.general_manager)

        response = self.client.delete(f"/api/cms/achievements/{self.achievement.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Achievement.objects.count(), 0)
