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

from apps.units.models import SchoolUnit

from apps.news.models import News, NewsCategory, NewsMedia



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


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class NewsPublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.category = NewsCategory.objects.create(
            title="اطلاعیه‌ها",
            slug="announcements",
            is_active=True,
            order=1,
        )

        self.inactive_category = NewsCategory.objects.create(
            title="دسته غیرفعال",
            slug="inactive-category",
            is_active=False,
            order=2,
        )

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.today = timezone.localdate()

    def create_news(
        self,
        title="خبر تست",
        slug="test-news",
        status=News.Status.PUBLISHED,
        scope=News.Scope.SCHOOL,
        unit=None,
        is_active=True,
        published_at=None,
        category=None,
        content_text="متن خبر ثبت نام",
    ):
        if published_at is None:
            published_at = self.today

        return News.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه خبر",
            category=category or self.category,
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=is_active,
            content_json=valid_content_json(content_text),
        )

    def test_news_categories_returns_only_active_categories(self):
        response = self.client.get("/api/news/categories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["slug"], "announcements")

    def test_news_list_returns_only_published_active_news(self):
        published_news = self.create_news(
            title="خبر منتشر شده",
            slug="published-news",
        )

        self.create_news(
            title="خبر پیش‌نویس",
            slug="draft-news",
            status=News.Status.DRAFT,
        )

        self.create_news(
            title="خبر غیرفعال",
            slug="inactive-news",
            is_active=False,
        )

        response = self.client.get("/api/news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], published_news.id)

    def test_future_published_news_is_not_public(self):
        self.create_news(
            title="خبر آینده",
            slug="future-news",
            published_at=self.today + timedelta(days=1),
        )

        response = self.client.get("/api/news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_news_detail_by_slug(self):
        self.create_news(
            title="خبر جزئیات",
            slug="detail-news",
        )

        response = self.client.get("/api/news/detail-news/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "خبر جزئیات")
        self.assertIn("content_json", response.data)

    def test_draft_news_detail_returns_404(self):
        self.create_news(
            title="خبر پیش‌نویس",
            slug="draft-detail",
            status=News.Status.DRAFT,
        )

        response = self.client.get("/api/news/draft-detail/")

        self.assertEqual(response.status_code, 404)

    def test_filter_school_scope_news(self):
        self.create_news(
            title="خبر عمومی مدرسه",
            slug="school-news",
            scope=News.Scope.SCHOOL,
            unit=None,
        )

        self.create_news(
            title="خبر واحد",
            slug="unit-news",
            scope=News.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get("/api/news/?scope=school&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "school-news")

    def test_filter_unit_scope_news(self):
        self.create_news(
            title="خبر عمومی مدرسه",
            slug="school-news",
            scope=News.Scope.SCHOOL,
            unit=None,
        )

        self.create_news(
            title="خبر واحد",
            slug="unit-news",
            scope=News.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get(f"/api/news/?scope=unit&unit_id={self.unit.id}&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "unit-news")
        self.assertEqual(response.data["results"][0]["unit"]["id"], self.unit.id)

    def test_unit_scope_without_unit_id_returns_empty_result(self):
        self.create_news(
            title="خبر واحد",
            slug="unit-news",
            scope=News.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get("/api/news/?scope=unit&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_status_other_than_published_returns_empty_result_in_public_api(self):
        self.create_news(
            title="خبر منتشر شده",
            slug="published-news",
        )

        response = self.client.get("/api/news/?status=draft")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_search_news_by_content_text(self):
        self.create_news(
            title="خبر جستجو",
            slug="search-news",
            content_text="ثبت نام پایه اول آغاز شد",
        )

        response = self.client.get("/api/news/?search=ثبت نام")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "search-news")


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class NewsModelValidationTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def test_school_scope_with_unit_is_invalid(self):
        news = News(
            title="خبر نامعتبر",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            unit=self.unit,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            news.full_clean()

    def test_unit_scope_without_unit_is_invalid(self):
        news = News(
            title="خبر نامعتبر",
            summary="خلاصه",
            scope=News.Scope.UNIT,
            unit=None,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            news.full_clean()

    def test_published_news_without_published_at_is_invalid(self):
        news = News(
            title="خبر بدون تاریخ",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.PUBLISHED,
            published_at=None,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            news.full_clean()

    def test_published_news_without_content_is_invalid(self):
        news = News(
            title="خبر بدون محتوا",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.PUBLISHED,
            published_at=timezone.localdate(),
            content_json={
                "time": None,
                "blocks": [],
                "version": None,
            },
        )

        with self.assertRaises(ValidationError):
            news.full_clean()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class NewsCMSAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.superuser = User.objects.create_superuser(
            username="admin",
            password="password123",
            email="admin@example.com",
        )

        self.client.force_authenticate(user=self.superuser)

        self.category = NewsCategory.objects.create(
            title="اخبار",
            slug="news",
            is_active=True,
        )

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def test_cms_news_list_requires_authenticated_user(self):
        unauthenticated_client = APIClient()

        response = unauthenticated_client.get("/api/cms/news/")

        self.assertEqual(response.status_code, 401)

    def test_cms_can_create_school_news_draft(self):
        payload = {
            "title": "خبر پیش‌نویس",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.SCHOOL,
            "unit": None,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "خبر پیش‌نویس")
        self.assertEqual(response.data["scope"], News.Scope.SCHOOL)

        news = News.objects.get(id=response.data["id"])
        self.assertEqual(news.created_by, self.superuser)
        self.assertEqual(news.updated_by, self.superuser)

    def test_cms_can_create_unit_news_draft(self):
        payload = {
            "title": "خبر واحد",
            "summary": "خلاصه خبر",
            "category": self.category.id,
            "scope": News.Scope.UNIT,
            "unit": self.unit.id,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر واحد"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], News.Scope.UNIT)
        self.assertEqual(response.data["unit"], self.unit.id)

    def test_cms_rejects_unit_scope_without_unit(self):
        payload = {
            "title": "خبر نامعتبر",
            "summary": "خلاصه خبر",
            "scope": News.Scope.UNIT,
            "unit": None,
            "status": News.Status.DRAFT,
            "content_json": valid_content_json("متن خبر"),
        }

        response = self.client.post("/api/cms/news/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("unit", response.data)

    def test_cms_upload_image_for_news_editor(self):
        news = News.objects.create(
            title="خبر دارای تصویر",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.superuser,
            updated_by=self.superuser,
        )

        image = make_test_image()

        response = self.client.post(
            f"/api/cms/news/{news.id}/upload-image/",
            {
                "image": image,
                "alt_text": "متن جایگزین",
                "caption": "کپشن تصویر",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["success"], 1)
        self.assertIn("url", response.data["file"])

        self.assertEqual(NewsMedia.objects.count(), 1)
        media = NewsMedia.objects.first()
        self.assertEqual(media.news, news)
        self.assertEqual(media.uploaded_by, self.superuser)

    def test_cms_rejects_non_image_upload(self):
        news = News.objects.create(
            title="خبر تست",
            summary="خلاصه",
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            content_json=valid_content_json(),
            created_by=self.superuser,
            updated_by=self.superuser,
        )

        invalid_file = SimpleUploadedFile(
            "bad.txt",
            b"not an image",
            content_type="text/plain",
        )

        response = self.client.post(
            f"/api/cms/news/{news.id}/upload-image/",
            {
                "image": invalid_file,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)