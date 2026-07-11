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

from apps.gallery.models import GalleryItem


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
class GalleryPublicAPITests(TestCase):
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

    def create_gallery_item(
        self,
        title="تصویر تست",
        slug="test-gallery-item",
        status=GalleryItem.Status.PUBLISHED,
        scope=GalleryItem.Scope.SCHOOL,
        unit=None,
        is_active=True,
        published_at=None,
        is_featured=False,
    ):
        if published_at is None:
            published_at = self.today

        return GalleryItem.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه تصویر",
            image=make_test_image(name=f"{slug}.webp"),
            alt_text="متن جایگزین",
            caption="کپشن",
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=is_active,
            is_featured=is_featured,
        )

    def test_gallery_list_returns_only_published_active_items(self):
        published_item = self.create_gallery_item(
            title="تصویر منتشر شده",
            slug="published-gallery",
        )

        self.create_gallery_item(
            title="تصویر پیش‌نویس",
            slug="draft-gallery",
            status=GalleryItem.Status.DRAFT,
            published_at=None,
        )

        self.create_gallery_item(
            title="تصویر غیرفعال",
            slug="inactive-gallery",
            is_active=False,
        )

        response = self.client.get("/api/gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], published_item.id)
        self.assertIn("image", response.data["results"][0])

    def test_future_gallery_item_is_not_public(self):
        self.create_gallery_item(
            title="تصویر آینده",
            slug="future-gallery",
            published_at=self.today + timedelta(days=1),
        )

        response = self.client.get("/api/gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_gallery_detail_by_slug(self):
        self.create_gallery_item(
            title="جزئیات تصویر",
            slug="detail-gallery",
        )

        response = self.client.get("/api/gallery/detail-gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "جزئیات تصویر")
        self.assertIn("image", response.data)

    def test_draft_gallery_detail_returns_404(self):
        self.create_gallery_item(
            title="تصویر پیش‌نویس",
            slug="draft-detail-gallery",
            status=GalleryItem.Status.DRAFT,
            published_at=None,
        )

        response = self.client.get("/api/gallery/draft-detail-gallery/")

        self.assertEqual(response.status_code, 404)

    def test_filter_school_scope_gallery_items(self):
        self.create_gallery_item(
            title="تصویر عمومی مدرسه",
            slug="school-gallery",
            scope=GalleryItem.Scope.SCHOOL,
            unit=None,
        )

        self.create_gallery_item(
            title="تصویر واحد",
            slug="unit-gallery",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get("/api/gallery/?scope=school&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "school-gallery")
        self.assertIsNone(response.data["results"][0]["unit_id"])

    def test_filter_unit_scope_gallery_items(self):
        self.create_gallery_item(
            title="تصویر عمومی مدرسه",
            slug="school-gallery",
            scope=GalleryItem.Scope.SCHOOL,
            unit=None,
        )

        self.create_gallery_item(
            title="تصویر واحد",
            slug="unit-gallery",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit,
        )

        response = self.client.get(f"/api/gallery/?scope=unit&unit_id={self.unit.id}&status=published")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "unit-gallery")
        self.assertEqual(response.data["results"][0]["unit_id"], self.unit.id)

    def test_search_gallery_item(self):
        self.create_gallery_item(
            title="جشن پایان سال",
            slug="graduation-gallery",
        )

        response = self.client.get("/api/gallery/?search=پایان")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class GalleryModelValidationTests(TestCase):
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
        item = GalleryItem(
            title="تصویر نامعتبر",
            summary="خلاصه",
            image=make_test_image(),
            scope=GalleryItem.Scope.SCHOOL,
            unit=self.unit,
            status=GalleryItem.Status.DRAFT,
        )

        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_unit_scope_without_unit_is_invalid(self):
        item = GalleryItem(
            title="تصویر نامعتبر",
            summary="خلاصه",
            image=make_test_image(),
            scope=GalleryItem.Scope.UNIT,
            unit=None,
            status=GalleryItem.Status.DRAFT,
        )

        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_published_gallery_without_image_is_invalid(self):
        item = GalleryItem(
            title="تصویر بدون فایل",
            summary="خلاصه",
            scope=GalleryItem.Scope.SCHOOL,
            status=GalleryItem.Status.PUBLISHED,
            published_at=timezone.localdate(),
        )

        with self.assertRaises(ValidationError):
            item.full_clean()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class GalleryCMSPermissionTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

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

        self.school_item = self.create_gallery_item(
            title="تصویر عمومی مدرسه",
            slug="school-gallery",
            scope=GalleryItem.Scope.SCHOOL,
            unit=None,
        )

        self.unit_1_item = self.create_gallery_item(
            title="تصویر واحد دبستان",
            slug="unit-1-gallery",
            scope=GalleryItem.Scope.UNIT,
            unit=self.unit_1,
        )

        self.unit_2_item = self.create_gallery_item(
            title="تصویر واحد متوسطه",
            slug="unit-2-gallery",
            scope=GalleryItem.Scope.UNIT,
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

    def create_gallery_item(
        self,
        title,
        slug,
        scope,
        unit,
        status=GalleryItem.Status.DRAFT,
        published_at=None,
    ):
        return GalleryItem.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه تصویر",
            image=make_test_image(name=f"{slug}.webp"),
            scope=scope,
            unit=unit,
            status=status,
            published_at=published_at,
            is_active=True,
        )

    def test_parent_can_read_published_gallery_for_frontend(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/gallery/")

        self.assertEqual(response.status_code, 200)

    def test_general_manager_can_see_all_cms_gallery_items(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_unit_manager_sees_only_own_unit_gallery_items(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_item.id)

    def test_unit_media_sees_only_own_unit_gallery_items(self):
        self.authenticate(self.unit_media)

        response = self.client.get("/api/cms/gallery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.unit_1_item.id)

    def test_unit_media_can_create_gallery_item_for_own_unit(self):
        self.authenticate(self.unit_media)

        payload = {
            "title": "تصویر جدید دبستان",
            "summary": "خلاصه تصویر",
            "scope": GalleryItem.Scope.UNIT,
            "unit": self.unit_1.id,
            "status": GalleryItem.Status.DRAFT,
            "is_active": True,
            "image": make_test_image(name="new-gallery.webp"),
        }

        response = self.client.post("/api/cms/gallery/", payload, format="multipart")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["scope"], GalleryItem.Scope.UNIT)

    def test_unit_media_cannot_create_gallery_item_for_other_unit(self):
        self.authenticate(self.unit_media)

        payload = {
            "title": "تصویر واحد دیگر",
            "summary": "خلاصه تصویر",
            "scope": GalleryItem.Scope.UNIT,
            "unit": self.unit_2.id,
            "status": GalleryItem.Status.DRAFT,
            "is_active": True,
            "image": make_test_image(name="other-unit.webp"),
        }

        response = self.client.post("/api/cms/gallery/", payload, format="multipart")

        self.assertEqual(response.status_code, 403)

    def test_unit_media_can_submit_own_gallery_item_for_review(self):
        self.authenticate(self.unit_media)

        response = self.client.post(f"/api/cms/gallery/{self.unit_1_item.id}/submit-review/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_item.refresh_from_db()
        self.assertEqual(self.unit_1_item.status, GalleryItem.Status.WAITING_REVIEW)

    def test_unit_manager_can_approve_own_waiting_gallery_item(self):
        self.unit_1_item.status = GalleryItem.Status.WAITING_REVIEW
        self.unit_1_item.save()

        self.authenticate(self.unit_manager)

        response = self.client.post(f"/api/cms/gallery/{self.unit_1_item.id}/approve/")

        self.assertEqual(response.status_code, 200)

        self.unit_1_item.refresh_from_db()
        self.assertEqual(self.unit_1_item.status, GalleryItem.Status.APPROVED)

    def test_unit_media_cannot_publish_gallery_item(self):
        self.unit_1_item.status = GalleryItem.Status.APPROVED
        self.unit_1_item.save()

        self.authenticate(self.unit_media)

        response = self.client.post(f"/api/cms/gallery/{self.unit_1_item.id}/publish/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_publish_gallery_item(self):
        self.unit_1_item.status = GalleryItem.Status.APPROVED
        self.unit_1_item.save()

        self.authenticate(self.general_manager)

        response = self.client.post(
            f"/api/cms/gallery/{self.unit_1_item.id}/publish/",
            {
                "published_at": str(timezone.localdate()),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.unit_1_item.refresh_from_db()
        self.assertEqual(self.unit_1_item.status, GalleryItem.Status.PUBLISHED)
        self.assertEqual(self.unit_1_item.published_by, self.general_manager)
