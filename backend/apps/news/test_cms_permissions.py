import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

from apps.news.models import News, NewsCategory, NewsMedia


User = get_user_model()


TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def valid_content_json(text="متن تست خبر"):
    return {
        "time": None,
        "blocks": [
            {
                "type": "paragraph",
                "data": {
                    "text": text,
                },
            }
        ],
        "version": None,
    }


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
class NewsCMSPermissionTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.category = NewsCategory.objects.create(
            title="اخبار",
            slug="news",
            is_active=True,
        )

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

        self.school_news = self.create_news(
            title="خبر عمومی مدرسه",
            slug="school-news",
            scope=News.Scope.SCHOOL,
            unit=None,
        )

        self.unit_1_news = self.create_news(
            title="خبر واحد دبستان",
            slug="unit-1-news",
            scope=News.Scope.UNIT,
            unit=self.unit_1,
        )

        self.unit_2_news = self.create_news(
            title="خبر واحد متوسطه",
            slug="unit-2-news",
            scope=News.Scope.UNIT,
            unit=self.unit_2,
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

    def create_news(
        self,
        title,
        slug,
        scope,
        unit,
        status=News.Status.DRAFT,
        published_at=None,
    ):
        return News.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه خبر",
            category=self.category,
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=True,
            content_json=valid_content_json(),
        )

    def test_parent_cannot_access_cms_news(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/news/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_see_all_cms_news(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_unit_manager_sees_only_own_unit_news(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_news.id)

    def test_unit_media_sees_only_own_unit_news_read_only(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/cms/news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_news.id)

    def test_unit_manager_can_create_news_for_own_unit(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "خبر جدید دبستان",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.UNIT,
            "unit": self.unit_1.id,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر جدید"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], News.Scope.UNIT)
        self.assertEqual(response.data["unit"], self.unit_1.id)

    def test_unit_manager_cannot_create_school_news(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "خبر عمومی غیرمجاز",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.SCHOOL,
            "unit": None,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_cannot_create_news_for_other_unit(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "خبر واحد دیگر",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.UNIT,
            "unit": self.unit_2.id,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_media_cannot_create_news(self):
        self.authenticate(self.unit_media)

        payload = {
            "title": "خبر توسط رسانه",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.UNIT,
            "unit": self.unit_1.id,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_submit_own_news_for_review(self):
        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/news/{self.unit_1_news.id}/submit-review/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_news.refresh_from_db()
        self.assertEqual(self.unit_1_news.status, News.Status.WAITING_REVIEW)

    def test_unit_manager_can_approve_own_waiting_review_news(self):
        self.unit_1_news.status = News.Status.WAITING_REVIEW
        self.unit_1_news.save()

        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/news/{self.unit_1_news.id}/approve/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_news.refresh_from_db()
        self.assertEqual(self.unit_1_news.status, News.Status.APPROVED)

    def test_unit_manager_cannot_publish_news(self):
        self.unit_1_news.status = News.Status.APPROVED
        self.unit_1_news.save()

        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/news/{self.unit_1_news.id}/publish/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_publish_news(self):
        self.unit_1_news.status = News.Status.APPROVED
        self.unit_1_news.save()

        self.authenticate(self.general_manager)

        response = self.client.post(
            f"/api/cms/news/{self.unit_1_news.id}/publish/",
            {
                "published_at": str(timezone.localdate()),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.unit_1_news.refresh_from_db()
        self.assertEqual(self.unit_1_news.status, News.Status.PUBLISHED)
        self.assertEqual(self.unit_1_news.published_by, self.general_manager)
        self.assertEqual(self.unit_1_news.published_at, timezone.localdate())

    def test_unit_media_can_upload_image_to_own_unit_news(self):
        self.authenticate(self.unit_media)

        image = make_test_image()

        response = self.client.post(
            f"/api/cms/news/{self.unit_1_news.id}/upload-image/",
            {
                "image": image,
                "alt_text": "متن جایگزین",
                "caption": "کپشن",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["success"], 1)
        self.assertEqual(NewsMedia.objects.count(), 1)

        media = NewsMedia.objects.first()
        self.assertEqual(media.news, self.unit_1_news)
        self.assertEqual(media.uploaded_by, self.unit_media)

    def test_unit_media_cannot_upload_image_to_other_unit_news(self):
        self.authenticate(self.unit_media)

        image = make_test_image()

        response = self.client.post(
            f"/api/cms/news/{self.unit_2_news.id}/upload-image/",
            {
                "image": image,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 404)

    def test_general_manager_can_create_school_news(self):
        self.authenticate(self.general_manager)

        payload = {
            "title": "خبر عمومی جدید",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.SCHOOL,
            "unit": None,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر عمومی"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], News.Scope.SCHOOL)

    def test_general_manager_can_archive_news(self):
        self.authenticate(self.general_manager)

        response = self.client.post(f"/api/cms/news/{self.school_news.id}/archive/")

        self.assertEqual(response.status_code, 200)

        self.school_news.refresh_from_db()
        self.assertEqual(self.school_news.status, News.Status.ARCHIVED)

    def test_general_manager_can_restore_archived_news(self):
        self.school_news.status = News.Status.ARCHIVED
        self.school_news.save()

        self.authenticate(self.general_manager)

        response = self.client.post(f"/api/cms/news/{self.school_news.id}/restore/")

        self.assertEqual(response.status_code, 200)

        self.school_news.refresh_from_db()
        self.assertEqual(self.school_news.status, News.Status.DRAFT)