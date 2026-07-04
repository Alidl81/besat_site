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

from apps.events.models import Event


User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_test_image(name="event.webp", image_format="WEBP", content_type="image/webp"):
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
class EventPublicAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()
        self.today = timezone.localdate()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
        )

    def create_event(
        self,
        title="رویداد تست",
        slug="test-event",
        scope=None,
        unit=None,
        status=None,
        is_active=True,
        is_featured=False,
        event_start_at=None,
        published_at=None,
    ):
        if scope is None:
            scope = Event.Scope.SCHOOL

        if status is None:
            status = Event.Status.PUBLISHED

        if event_start_at is None:
            event_start_at = self.now + timedelta(days=1)

        if published_at is None:
            published_at = self.today

        return Event.objects.create(
            title=title,
            slug=slug,
            summary="خلاصه رویداد",
            description="توضیحات رویداد",
            cover_image=make_test_image(name=f"{slug}.webp"),
            location="سالن مدرسه",
            event_start_at=event_start_at,
            event_end_at=event_start_at + timedelta(hours=2),
            published_at=published_at,
            scope=scope,
            unit=unit,
            status=status,
            is_active=is_active,
            is_featured=is_featured,
        )

    def test_events_list_returns_only_published_active_items(self):
        public_event = self.create_event(
            title="رویداد منتشرشده",
            slug="published-event",
        )

        self.create_event(
            title="رویداد پیش‌نویس",
            slug="draft-event",
            status=Event.Status.DRAFT,
            published_at=None,
        )

        response = self.client.get("/api/events/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], public_event.id)
        self.assertEqual(response.data["results"][0]["type"], "event")
        self.assertIn("image", response.data["results"][0])

    def test_event_detail_by_slug(self):
        self.create_event(
            title="رویداد جزئیات",
            slug="detail-event",
        )

        response = self.client.get("/api/events/detail-event/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "رویداد جزئیات")
        self.assertEqual(response.data["description"], "توضیحات رویداد")

    def test_draft_event_detail_returns_404(self):
        self.create_event(
            title="رویداد پیش‌نویس",
            slug="draft-detail-event",
            status=Event.Status.DRAFT,
            published_at=None,
        )

        response = self.client.get("/api/events/draft-detail-event/")

        self.assertEqual(response.status_code, 404)

    def test_filter_featured_events(self):
        self.create_event(
            title="رویداد ویژه",
            slug="featured-event",
            is_featured=True,
        )

        self.create_event(
            title="رویداد معمولی",
            slug="normal-event",
            is_featured=False,
        )

        response = self.client.get("/api/events/?featured=true")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "featured-event")

    def test_filter_unit_events(self):
        self.create_event(
            title="رویداد واحد",
            slug="unit-event",
            scope=Event.Scope.UNIT,
            unit=self.unit,
        )

        self.create_event(
            title="رویداد مدرسه",
            slug="school-event",
            scope=Event.Scope.SCHOOL,
            unit=None,
        )

        response = self.client.get(f"/api/events/?unit_id={self.unit.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["unit_id"], self.unit.id)


class EventModelValidationTests(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def test_event_end_at_must_be_after_start_at(self):
        event = Event(
            title="رویداد نامعتبر",
            event_start_at=self.now,
            event_end_at=self.now - timedelta(hours=1),
        )

        with self.assertRaises(ValidationError):
            event.full_clean()

    def test_unit_scope_requires_unit(self):
        event = Event(
            title="رویداد واحدی",
            scope=Event.Scope.UNIT,
            event_start_at=self.now,
        )

        with self.assertRaises(ValidationError):
            event.full_clean()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class EventCMSAPITests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()
        self.today = timezone.localdate()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="primary-school",
            is_active=True,
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
            unit=self.unit,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )
        UserUnitMembership.objects.create(
            user=self.unit_media,
            unit=self.unit,
            role=UserUnitMembership.UnitRole.UNIT_MEDIA,
            is_active=True,
        )

        self.event = Event.objects.create(
            title="رویداد CMS",
            slug="cms-event",
            summary="خلاصه",
            description="توضیحات",
            cover_image=make_test_image("cms-event.webp"),
            location="سالن مدرسه",
            event_start_at=self.now + timedelta(days=1),
            event_end_at=self.now + timedelta(days=1, hours=2),
            published_at=self.today,
            scope=Event.Scope.UNIT,
            unit=self.unit,
            status=Event.Status.PUBLISHED,
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

    def test_general_manager_can_list_all_events(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/events/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_unit_manager_can_list_own_unit_events(self):
        self.authenticate(self.unit_manager)

        response = self.client.get("/api/cms/events/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.event.id)

    def test_parent_cannot_list_events(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/events/")

        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_list_events(self):
        response = self.client.get("/api/cms/events/")

        self.assertEqual(response.status_code, 401)

    def test_unit_media_can_create_own_unit_event_draft(self):
        self.authenticate(self.unit_media)

        payload = {
            "title": "رویداد رسانه",
            "summary": "خلاصه رویداد",
            "description": "توضیحات رویداد",
            "location": "کلاس",
            "event_start_at": (self.now + timedelta(days=2)).isoformat(),
            "event_end_at": (self.now + timedelta(days=2, hours=2)).isoformat(),
            "scope": Event.Scope.UNIT,
            "unit": self.unit.id,
            "status": Event.Status.DRAFT,
            "is_active": True,
            "is_featured": False,
            "cover_image": make_test_image("media-event.webp"),
        }

        response = self.client.post(
            "/api/cms/events/",
            payload,
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Event.objects.count(), 2)

    def test_unit_media_cannot_publish_event(self):
        self.authenticate(self.unit_media)

        response = self.client.post(f"/api/cms/events/{self.event.id}/publish/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_publish_event(self):
        self.authenticate(self.general_manager)

        draft_event = Event.objects.create(
            title="رویداد قابل انتشار",
            slug="publishable-event",
            summary="خلاصه",
            description="توضیحات",
            event_start_at=self.now + timedelta(days=3),
            scope=Event.Scope.SCHOOL,
            status=Event.Status.APPROVED,
            is_active=True,
        )

        response = self.client.post(f"/api/cms/events/{draft_event.id}/publish/")

        self.assertEqual(response.status_code, 200)

        draft_event.refresh_from_db()
        self.assertEqual(draft_event.status, Event.Status.PUBLISHED)
        self.assertEqual(draft_event.published_at, self.today)
        self.assertEqual(draft_event.published_by, self.general_manager)

    def test_unit_manager_can_approve_own_unit_event(self):
        self.authenticate(self.unit_manager)

        waiting_event = Event.objects.create(
            title="رویداد در انتظار بررسی",
            slug="waiting-event",
            summary="خلاصه",
            description="توضیحات",
            event_start_at=self.now + timedelta(days=3),
            scope=Event.Scope.UNIT,
            unit=self.unit,
            status=Event.Status.WAITING_REVIEW,
            is_active=True,
        )

        response = self.client.post(f"/api/cms/events/{waiting_event.id}/approve/")

        self.assertEqual(response.status_code, 200)

        waiting_event.refresh_from_db()
        self.assertEqual(waiting_event.status, Event.Status.APPROVED)

    def test_general_manager_can_delete_event(self):
        self.authenticate(self.general_manager)

        response = self.client.delete(f"/api/cms/events/{self.event.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Event.objects.count(), 0)