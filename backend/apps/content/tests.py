from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.announcements.models import Announcement, AnnouncementCategory
from apps.gallery.models import GalleryItem
from apps.news.models import News, NewsCategory
from apps.units.models import SchoolUnit


def valid_content_json(text="متن تست"):
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


class ContentAggregateAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

        self.news_category = NewsCategory.objects.create(
            title="اخبار",
            slug="news",
            is_active=True,
        )

        self.announcement_category = AnnouncementCategory.objects.create(
            title="اطلاعیه‌ها",
            slug="announcements",
            is_active=True,
        )

        self.school_news = News.objects.create(
            title="خبر عمومی مدرسه",
            slug="school-news",
            summary="خلاصه خبر عمومی",
            category=self.news_category,
            scope=News.Scope.SCHOOL,
            unit=None,
            status=News.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
            is_featured=True,
            content_json=valid_content_json("ثبت نام خبر عمومی"),
        )

        self.unit_news = News.objects.create(
            title="خبر واحد دبستان",
            slug="unit-news",
            summary="خلاصه خبر واحد",
            category=self.news_category,
            scope=News.Scope.UNIT,
            unit=self.unit,
            status=News.Status.PUBLISHED,
            published_at=self.today - timedelta(days=1),
            is_active=True,
            is_featured=False,
            content_json=valid_content_json("اردوی دانش آموزان دبستان"),
        )

        self.school_announcement = Announcement.objects.create(
            title="اطلاعیه عمومی مدرسه",
            slug="school-announcement",
            summary="خلاصه اطلاعیه عمومی",
            category=self.announcement_category,
            scope=Announcement.Scope.SCHOOL,
            unit=None,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
            is_featured=True,
            content_json=valid_content_json("ثبت نام اطلاعیه عمومی"),
        )

        self.unit_announcement = Announcement.objects.create(
            title="اطلاعیه واحد دبستان",
            slug="unit-announcement",
            summary="خلاصه اطلاعیه واحد",
            category=self.announcement_category,
            scope=Announcement.Scope.UNIT,
            unit=self.unit,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today - timedelta(days=2),
            is_active=True,
            is_featured=False,
            content_json=valid_content_json("جلسه والدین دبستان"),
        )

        News.objects.create(
            title="خبر پیش‌نویس",
            slug="draft-news",
            summary="خلاصه",
            category=self.news_category,
            scope=News.Scope.SCHOOL,
            status=News.Status.DRAFT,
            is_active=True,
            content_json=valid_content_json("خبر پیش‌نویس"),
        )

        Announcement.objects.create(
            title="اطلاعیه آینده",
            slug="future-announcement",
            summary="خلاصه",
            category=self.announcement_category,
            scope=Announcement.Scope.SCHOOL,
            status=Announcement.Status.PUBLISHED,
            published_at=self.today + timedelta(days=1),
            is_active=True,
            content_json=valid_content_json("اطلاعیه آینده"),
        )

        self.unit_gallery_item = GalleryItem.objects.create(
            title="تصویر واحد دبستان",
            slug="unit-gallery-item",
            summary="گزارش تصویری واحد",
            media_url="https://cdn.example.com/gallery/unit.jpg",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit,
            status=GalleryItem.Status.PUBLISHED,
            published_at=self.today,
            is_active=True,
        )

    def test_content_aggregate_returns_all_supported_types(self):
        response = self.client.get("/api/content/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 5)

        returned_types = {item["type"] for item in response.data["results"]}

        self.assertEqual(returned_types, {"news", "announcement", "gallery"})

    def test_content_type_gallery_matches_frontend_unit_service(self):
        response = self.client.get(
            f"/api/content/?type=gallery&scope=unit&unit_id={self.unit.id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["type"], "gallery")
        self.assertEqual(response.data["results"][0]["unit_id"], self.unit.id)

    def test_content_type_news_returns_only_news(self):
        response = self.client.get("/api/content/?type=news")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "news")

    def test_content_type_announcement_returns_only_announcements(self):
        response = self.client.get("/api/content/?type=announcement")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "announcement")

    def test_content_status_other_than_published_returns_empty_result(self):
        response = self.client.get("/api/content/?status=draft")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_content_filter_school_scope(self):
        response = self.client.get("/api/content/?scope=school")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["scope"], "school")
            self.assertIsNone(item["unit"])

    def test_content_filter_unit_scope(self):
        response = self.client.get(f"/api/content/?scope=unit&unit_id={self.unit.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

        for item in response.data["results"]:
            self.assertEqual(item["scope"], "unit")
            self.assertEqual(item["unit"]["id"], self.unit.id)

    def test_content_unit_scope_without_unit_id_returns_empty_result(self):
        response = self.client.get("/api/content/?scope=unit")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_content_search_across_news_and_announcements(self):
        response = self.client.get("/api/content/?search=ثبت نام")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        returned_types = {item["type"] for item in response.data["results"]}

        self.assertEqual(returned_types, {"news", "announcement"})

    def test_content_featured_filter(self):
        response = self.client.get("/api/content/?featured=true")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertTrue(item["is_featured"])

    def test_content_category_filter_news_slug(self):
        response = self.client.get("/api/content/?category=news")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "news")

    def test_content_category_filter_announcement_slug(self):
        response = self.client.get("/api/content/?category=announcements")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        for item in response.data["results"]:
            self.assertEqual(item["type"], "announcement")

    def test_content_invalid_type_returns_400(self):
        response = self.client.get("/api/content/?type=video")

        self.assertEqual(response.status_code, 400)

    def test_content_ordering_by_title(self):
        response = self.client.get("/api/content/?ordering=title")

        self.assertEqual(response.status_code, 200)

        titles = [item["title"] for item in response.data["results"]]

        self.assertEqual(titles, sorted(titles))
