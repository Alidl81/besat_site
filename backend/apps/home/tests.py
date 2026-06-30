import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile
from apps.announcements.models import Announcement
from apps.departments.models import Department
from apps.gallery.models import GalleryItem
from apps.news.models import News
from apps.site_settings.models import SiteSettings
from apps.units.models import SchoolUnit

from apps.home.models import HomeSlide


User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_test_image(name="test.webp", image_format="WEBP", content_type="image/webp"):
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
class HomePublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

    def test_home_returns_empty_structured_payload(self):
        response = self.client.get("/api/home/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("settings", response.data)
        self.assertIn("slides", response.data)
        self.assertIn("units", response.data)
        self.assertIn("departments", response.data)
        self.assertIn("latest_news", response.data)
        self.assertIn("latest_announcements", response.data)
        self.assertIn("featured_gallery", response.data)
        self.assertIn("featured_achievements", response.data)

        self.assertIsNone(response.data["settings"])
        self.assertEqual(response.data["slides"], [])
        self.assertEqual(response.data["units"], [])
        self.assertEqual(response.data["departments"], [])
        self.assertEqual(response.data["latest_news"], [])
        self.assertEqual(response.data["latest_announcements"], [])
        self.assertEqual(response.data["featured_gallery"], [])
        self.assertEqual(response.data["featured_achievements"], [])

    def test_home_returns_active_public_data(self):
        SiteSettings.objects.create(
            school_name="مدرسه بعثت",
            short_name="بعثت",
            is_active=True,
        )

        unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
            order=1,
        )

        Department.objects.create(
            title="گروه آموزشی",
            slug="education",
            short_description="توضیح کوتاه",
            description="توضیح کامل",
            is_active=True,
            order=1,
        )

        HomeSlide.objects.create(
            title="اسلاید اول",
            subtitle="زیرعنوان",
            image=make_test_image("slide.webp"),
            href="/about",
            is_active=True,
            order=1,
        )
        content_json = {
            "time": 0,
            "blocks": [
                {
                    "type": "paragraph",
                    "data": {
                        "text": "متن تستی محتوا"
                    },
                }
            ],
            "version": "2.28.2",
        }

        News.objects.create(
            title="خبر مدرسه",
            slug="school-news",
            summary="خلاصه خبر",
            content_text="متن خبر",
            content_json=content_json,
            scope=News.Scope.SCHOOL,
            status=News.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
        )

        Announcement.objects.create(
            title="اطلاعیه مدرسه",
            slug="school-announcement",
            summary="خلاصه اطلاعیه",
            content_json=content_json,
            content_text="متن اطلاعیه",
            scope=Announcement.Scope.SCHOOL,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
        )

        GalleryItem.objects.create(
            title="گالری ویژه",
            slug="featured-gallery",
            summary="خلاصه تصویر",
            image=make_test_image("gallery.webp"),
            scope=GalleryItem.Scope.SCHOOL,
            status=GalleryItem.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
            is_featured=True,
        )

        response = self.client.get("/api/home/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["settings"]["school_name"], "مدرسه بعثت")
        self.assertEqual(len(response.data["slides"]), 1)
        self.assertEqual(response.data["slides"][0]["title"], "اسلاید اول")
        self.assertEqual(len(response.data["units"]), 1)
        self.assertEqual(response.data["units"][0]["id"], unit.id)
        self.assertEqual(len(response.data["departments"]), 1)
        self.assertEqual(len(response.data["latest_news"]), 1)
        self.assertEqual(len(response.data["latest_announcements"]), 1)
        self.assertEqual(len(response.data["featured_gallery"]), 1)

    def test_home_does_not_return_inactive_slide(self):
        HomeSlide.objects.create(
            title="اسلاید غیرفعال",
            image=make_test_image("inactive-slide.webp"),
            is_active=False,
            order=1,
        )

        response = self.client.get("/api/home/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slides"], [])


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class HomeSlideCMSAPITests(TestCase):
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

        self.slide = HomeSlide.objects.create(
            title="اسلاید تست",
            subtitle="زیرعنوان",
            image=make_test_image("cms-slide.webp"),
            href="/about",
            is_active=True,
            order=1,
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

    def test_general_manager_can_list_home_slides(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/home-slides/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "اسلاید تست")

    def test_parent_cannot_list_home_slides(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/home-slides/")

        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_list_home_slides(self):
        response = self.client.get("/api/cms/home-slides/")

        self.assertEqual(response.status_code, 401)

    def test_general_manager_can_create_home_slide(self):
        self.authenticate(self.general_manager)

        payload = {
            "title": "اسلاید جدید",
            "subtitle": "زیرعنوان جدید",
            "href": "/registration",
            "is_active": True,
            "order": 2,
            "image": make_test_image("new-slide.webp"),
        }

        response = self.client.post(
            "/api/cms/home-slides/",
            payload,
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(HomeSlide.objects.count(), 2)
        self.assertEqual(response.data["title"], "اسلاید جدید")

    def test_general_manager_can_update_home_slide(self):
        self.authenticate(self.general_manager)

        response = self.client.patch(
            f"/api/cms/home-slides/{self.slide.id}/",
            {
                "title": "اسلاید ویرایش‌شده",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.slide.refresh_from_db()
        self.assertEqual(self.slide.title, "اسلاید ویرایش‌شده")

    def test_general_manager_can_delete_home_slide(self):
        self.authenticate(self.general_manager)

        response = self.client.delete(f"/api/cms/home-slides/{self.slide.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(HomeSlide.objects.count(), 0)