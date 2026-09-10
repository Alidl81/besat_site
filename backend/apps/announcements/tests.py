import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

from apps.announcements.models import Announcement, AnnouncementCategory


User = get_user_model()


TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def valid_content_json(text="متن تست اطلاعیه"):
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
class AnnouncementPublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.category = AnnouncementCategory.objects.create(
            title="اطلاعیه‌ها",
            slug="announcements",
            is_active=True,
            order=1,
        )

        self.inactive_category = AnnouncementCategory.objects.create(
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

    def create_announcement(
        self,
        title="اطلاعیه تست",
        slug="test-announcement",
        status=Announcement.Status.PUBLISHED,
        scope=Announcement.Scope.SCHOOL,
        unit=None,
        is_active=True,
        published_at=None,
        category=None,
        content_text="متن اطلاعیه ثبت نام",
    ):
        if published_at is None:
            published_at = self.today

        return Announcement.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه اطلاعیه",
            category=category or self.category,
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=is_active,
            content_json=valid_content_json(content_text),
        )

    def test_announcement_categories_returns_only_active_categories(self):
        response = self.client.get("/api/announcements/categories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["slug"], "announcements")

    def test_announcement_list_returns_only_published_active_items(self):
        published_announcement = self.create_announcement(
            title="اطلاعیه منتشر شده",
            slug="published-announcement",
        )

        self.create_announcement(
            title="اطلاعیه پیش‌نویس",
            slug="draft-announcement",
            status=Announcement.Status.DRAFT,
        )

        self.create_announcement(
            title="اطلاعیه غیرفعال",
            slug="inactive-announcement",
            is_active=False,
        )

        response = self.client.get("/api/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], published_announcement.id)

    def test_future_published_announcement_is_not_public(self):
        self.create_announcement(
            title="اطلاعیه آینده",
            slug="future-announcement",
            published_at=self.today + timedelta(days=1),
        )

        response = self.client.get("/api/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_announcement_detail_by_slug(self):
        self.create_announcement(
            title="اطلاعیه جزئیات",
            slug="detail-announcement",
        )

        response = self.client.get("/api/announcements/detail-announcement/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "اطلاعیه جزئیات")
        self.assertIn("content_json", response.data)

    def test_draft_announcement_detail_returns_404(self):
        self.create_announcement(
            title="اطلاعیه پیش‌نویس",
            slug="draft-detail",
            status=Announcement.Status.DRAFT,
        )

        response = self.client.get("/api/announcements/draft-detail/")

        self.assertEqual(response.status_code, 404)

    def test_filter_school_scope_announcements(self):
        self.create_announcement(
            title="اطلاعیه عمومی مدرسه",
            slug="school-announcement",
            scope=Announcement.Scope.SCHOOL,
            unit=None,
        )

        self.create_announcement(
            title="اطلاعیه واحد",
            slug="unit-announcement",
            scope=Announcement.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get("/api/announcements/?scope=school&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "school-announcement")

    def test_filter_unit_scope_announcements(self):
        self.create_announcement(
            title="اطلاعیه عمومی مدرسه",
            slug="school-announcement",
            scope=Announcement.Scope.SCHOOL,
            unit=None,
        )

        self.create_announcement(
            title="اطلاعیه واحد",
            slug="unit-announcement",
            scope=Announcement.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get(f"/api/announcements/?scope=unit&unit_id={self.unit.id}&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "unit-announcement")
        self.assertEqual(response.data["results"][0]["unit"]["id"], self.unit.id)

    def test_unit_scope_without_unit_id_returns_empty_result(self):
        self.create_announcement(
            title="اطلاعیه واحد",
            slug="unit-announcement",
            scope=Announcement.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get("/api/announcements/?scope=unit&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_search_announcement_by_content_text(self):
        self.create_announcement(
            title="اطلاعیه جستجو",
            slug="search-announcement",
            content_text="ثبت نام پایه اول آغاز شد",
        )

        response = self.client.get("/api/announcements/?search=ثبت نام")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "search-announcement")


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AnnouncementModelValidationTests(TestCase):
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
        announcement = Announcement(
            title="اطلاعیه نامعتبر",
            summary="خلاصه",
            scope=Announcement.Scope.SCHOOL,
            unit=self.unit,
            status=Announcement.Status.DRAFT,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            announcement.full_clean()

    def test_unit_scope_without_unit_is_invalid(self):
        announcement = Announcement(
            title="اطلاعیه نامعتبر",
            summary="خلاصه",
            scope=Announcement.Scope.UNIT,
            unit=None,
            status=Announcement.Status.DRAFT,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            announcement.full_clean()

    def test_published_announcement_without_published_at_is_invalid(self):
        announcement = Announcement(
            title="اطلاعیه بدون تاریخ",
            summary="خلاصه",
            scope=Announcement.Scope.SCHOOL,
            status=Announcement.Status.PUBLISHED,
            published_at=None,
            content_json=valid_content_json(),
        )

        with self.assertRaises(ValidationError):
            announcement.full_clean()

    def test_published_announcement_without_content_is_invalid(self):
        announcement = Announcement(
            title="اطلاعیه بدون محتوا",
            summary="خلاصه",
            scope=Announcement.Scope.SCHOOL,
            status=Announcement.Status.PUBLISHED,
            published_at=timezone.localdate(),
            content_json={
                "time": None,
                "blocks": [],
                "version": None,
            },
        )

        with self.assertRaises(ValidationError):
            announcement.full_clean()
