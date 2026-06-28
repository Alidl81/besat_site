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

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

from apps.announcements.models import Announcement, AnnouncementCategory, AnnouncementMedia


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


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AnnouncementCMSPermissionTests(TestCase):
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

        self.school_announcement = self.create_announcement(
            title="اطلاعیه عمومی مدرسه",
            slug="school-announcement",
            scope=Announcement.Scope.SCHOOL,
            unit=None,
        )

        self.unit_1_announcement = self.create_announcement(
            title="اطلاعیه واحد دبستان",
            slug="unit-1-announcement",
            scope=Announcement.Scope.UNIT,
            unit=self.unit_1,
        )

        self.unit_2_announcement = self.create_announcement(
            title="اطلاعیه واحد متوسطه",
            slug="unit-2-announcement",
            scope=Announcement.Scope.UNIT,
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

    def create_announcement(
        self,
        title,
        slug,
        scope,
        unit,
        status=Announcement.Status.DRAFT,
        published_at=None,
    ):
        return Announcement.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه اطلاعیه",
            category=self.category,
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=True,
            content_json=valid_content_json(),
        )

    def test_parent_cannot_access_cms_announcements(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/announcements/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_see_all_cms_announcements(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_unit_manager_sees_only_own_unit_announcements(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_announcement.id)

    def test_unit_media_sees_only_own_unit_announcements_read_only(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/cms/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_announcement.id)

    def test_unit_manager_can_create_announcement_for_own_unit(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "اطلاعیه جدید دبستان",
            "summary": "خلاصه اطلاعیه",
            "category": self.category.id,
            "scope": Announcement.Scope.UNIT,
            "unit": self.unit_1.id,
            "status": Announcement.Status.DRAFT,
            "content_json": valid_content_json("متن اطلاعیه جدید"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/announcements/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], Announcement.Scope.UNIT)
        self.assertEqual(response.data["unit"], self.unit_1.id)

    def test_unit_manager_cannot_create_school_announcement(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "اطلاعیه عمومی غیرمجاز",
            "summary": "خلاصه اطلاعیه",
            "category": self.category.id,
            "scope": Announcement.Scope.SCHOOL,
            "unit": None,
            "status": Announcement.Status.DRAFT,
            "content_json": valid_content_json("متن اطلاعیه"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/announcements/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_cannot_create_announcement_for_other_unit(self):
        self.authenticate(self.unit_manager)

        payload = {
            "title": "اطلاعیه واحد دیگر",
            "summary": "خلاصه اطلاعیه",
            "category": self.category.id,
            "scope": Announcement.Scope.UNIT,
            "unit": self.unit_2.id,
            "status": Announcement.Status.DRAFT,
            "content_json": valid_content_json("متن اطلاعیه"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/announcements/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_media_cannot_create_announcement(self):
        self.authenticate(self.unit_media)

        payload = {
            "title": "اطلاعیه توسط رسانه",
            "summary": "خلاصه اطلاعیه",
            "category": self.category.id,
            "scope": Announcement.Scope.UNIT,
            "unit": self.unit_1.id,
            "status": Announcement.Status.DRAFT,
            "content_json": valid_content_json("متن اطلاعیه"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/announcements/", payload, format="json")

        self.assertEqual(response.status_code, 403)

    def test_unit_manager_can_submit_own_announcement_for_review(self):
        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/announcements/{self.unit_1_announcement.id}/submit-review/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_announcement.refresh_from_db()
        self.assertEqual(self.unit_1_announcement.status, Announcement.Status.WAITING_REVIEW)

    def test_unit_manager_can_approve_own_waiting_review_announcement(self):
        self.unit_1_announcement.status = Announcement.Status.WAITING_REVIEW
        self.unit_1_announcement.save()

        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/announcements/{self.unit_1_announcement.id}/approve/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_announcement.refresh_from_db()
        self.assertEqual(self.unit_1_announcement.status, Announcement.Status.APPROVED)

    def test_unit_manager_cannot_publish_announcement(self):
        self.unit_1_announcement.status = Announcement.Status.APPROVED
        self.unit_1_announcement.save()

        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/announcements/{self.unit_1_announcement.id}/publish/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_publish_announcement(self):
        self.unit_1_announcement.status = Announcement.Status.APPROVED
        self.unit_1_announcement.save()

        self.authenticate(self.general_manager)

        response = self.client.post(
            f"/api/cms/announcements/{self.unit_1_announcement.id}/publish/",
            {
                "published_at": str(timezone.localdate()),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.unit_1_announcement.refresh_from_db()
        self.assertEqual(self.unit_1_announcement.status, Announcement.Status.PUBLISHED)
        self.assertEqual(self.unit_1_announcement.published_by, self.general_manager)
        self.assertEqual(self.unit_1_announcement.published_at, timezone.localdate())

    def test_unit_media_can_upload_image_to_own_unit_announcement(self):
        self.authenticate(self.unit_media)

        image = make_test_image()

        response = self.client.post(
            f"/api/cms/announcements/{self.unit_1_announcement.id}/upload-image/",
            {
                "image": image,
                "alt_text": "متن جایگزین",
                "caption": "کپشن",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["success"], 1)
        self.assertEqual(AnnouncementMedia.objects.count(), 1)

        media = AnnouncementMedia.objects.first()
        self.assertEqual(media.announcement, self.unit_1_announcement)
        self.assertEqual(media.uploaded_by, self.unit_media)

    def test_unit_media_cannot_upload_image_to_other_unit_announcement(self):
        self.authenticate(self.unit_media)

        image = make_test_image()

        response = self.client.post(
            f"/api/cms/announcements/{self.unit_2_announcement.id}/upload-image/",
            {
                "image": image,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 404)

    def test_general_manager_can_create_school_announcement(self):
        self.authenticate(self.general_manager)

        payload = {
            "title": "اطلاعیه عمومی جدید",
            "summary": "خلاصه اطلاعیه",
            "category": self.category.id,
            "scope": Announcement.Scope.SCHOOL,
            "unit": None,
            "status": Announcement.Status.DRAFT,
            "content_json": valid_content_json("متن اطلاعیه عمومی"),
            "is_active": True,
        }

        response = self.client.post("/api/cms/announcements/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], Announcement.Scope.SCHOOL)

    def test_general_manager_can_archive_announcement(self):
        self.authenticate(self.general_manager)

        response = self.client.post(f"/api/cms/announcements/{self.school_announcement.id}/archive/")

        self.assertEqual(response.status_code, 200)

        self.school_announcement.refresh_from_db()
        self.assertEqual(self.school_announcement.status, Announcement.Status.ARCHIVED)

    def test_general_manager_can_restore_archived_announcement(self):
        self.school_announcement.status = Announcement.Status.ARCHIVED
        self.school_announcement.save()

        self.authenticate(self.general_manager)

        response = self.client.post(f"/api/cms/announcements/{self.school_announcement.id}/restore/")

        self.assertEqual(response.status_code, 200)

        self.school_announcement.refresh_from_db()
        self.assertEqual(self.school_announcement.status, Announcement.Status.DRAFT)