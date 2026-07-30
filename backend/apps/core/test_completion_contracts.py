import shutil
import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.news.models import News
from apps.units.models import SchoolUnit


User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def image_upload():
    stream = BytesIO()
    Image.new("RGB", (20, 20), color="white").save(stream, "PNG")
    return SimpleUploadedFile(
        "media.png",
        stream.getvalue(),
        content_type="image/png",
    )


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class CompletionContractTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.unit = SchoolUnit.objects.create(
            title="واحد قرارداد",
            slug="contract-unit",
            kind=SchoolUnit.Kind.ELEMENTARY,
            gender=SchoolUnit.Gender.MIXED,
            is_active=True,
        )
        self.manager = self.make_user(
            "manager-completion",
            UserProfile.Role.GENERAL_MANAGER,
        )
        self.media = self.make_user(
            "media-completion",
            UserProfile.Role.UNIT_MEDIA,
        )
        self.parent = self.make_user(
            "parent-completion",
            UserProfile.Role.PARENT,
        )
        for user, role in (
            (self.media, UserUnitMembership.UnitRole.UNIT_MEDIA),
            (self.parent, UserUnitMembership.UnitRole.PARENT),
        ):
            UserUnitMembership.objects.create(user=user, unit=self.unit, role=role)

    def make_user(self, username, role):
        user = User.objects.create_user(username=username, password="password123")
        profile = user.profile
        profile.role = role
        profile.full_name = username
        profile.is_active = True
        profile.save()
        return user

    def test_important_news_filter_excludes_unpublished_content(self):
        common = {
            "summary": "خلاصه",
            "content_json": {
                "blocks": [{"type": "paragraph", "data": {"text": "متن"}}]
            },
            "published_at": timezone.localdate(),
            "is_important": True,
        }
        published = News.objects.create(
            title="خبر مهم منتشرشده",
            slug="published-important",
            status=News.Status.PUBLISHED,
            **common,
        )
        News.objects.create(
            title="خبر مهم پیش‌نویس",
            slug="draft-important",
            status=News.Status.DRAFT,
            published_at=None,
            summary="خلاصه",
            content_json=common["content_json"],
            is_important=True,
        )
        response = self.client.get("/api/news/?important=true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [published.id])

    def test_closed_unit_rejects_public_registration(self):
        self.unit.accepts_registration = False
        self.unit.save()
        response = self.client.post(
            "/api/registration-requests/",
            {
                "student_full_name": "دانش آموز",
                "parent_phone": "09120000000",
                "requested_unit": self.unit.id,
                "requested_grade": "اول",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("requested_unit", response.data)

    def test_media_upload_is_scoped_and_parent_is_denied(self):
        self.client.force_authenticate(self.media)
        response = self.client.post(
            "/api/cms/media/",
            {"file": image_upload(), "alt_text": "تصویر"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["unit"], self.unit.id)
        self.assertEqual(response.data["media_type"], "image")

        self.client.force_authenticate(self.parent)
        response = self.client.post(
            "/api/cms/media/",
            {"file": image_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)

    def test_content_workflow_requires_order_and_schedules_by_date(self):
        self.client.force_authenticate(self.manager)
        created = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر گردش کار",
                "body_html": "<p>متن</p>",
                "summary": "خلاصه",
                "scope": "school",
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        endpoint = f"/api/cms/content/{created.data['id']}/"
        direct_publish = self.client.post(
            f"{endpoint}publish/",
            {},
            format="json",
        )
        self.assertEqual(direct_publish.status_code, 400)

        submitted = self.client.post(
            f"{endpoint}submit-review/",
            {},
            format="json",
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "waiting_review")
        approved = self.client.post(f"{endpoint}approve/", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], "approved")

        future_date = timezone.localdate() + timedelta(days=2)
        scheduled = self.client.post(
            f"{endpoint}schedule/",
            {"scheduled_at": future_date.isoformat()},
            format="json",
        )
        self.assertEqual(scheduled.status_code, 200, scheduled.data)
        self.assertEqual(scheduled.data["status"], "scheduled")
        public = self.client.get("/api/news/")
        self.assertNotIn(
            created.data["id"],
            [f"news-{item['id']}" for item in public.data["results"]],
        )

    def test_media_role_cannot_publish_and_parent_cannot_manage_students(self):
        self.client.force_authenticate(self.media)
        created = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر رسانه",
                "body_html": "<p>متن</p>",
                "scope": "unit",
                "unit_id": self.unit.id,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        endpoint = f"/api/cms/content/{created.data['id']}/"
        submitted = self.client.post(
            f"{endpoint}submit-review/",
            {},
            format="json",
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "waiting_review")
        attempted_approve = self.client.post(
            f"{endpoint}approve/",
            {},
            format="json",
        )
        self.assertEqual(attempted_approve.status_code, 403)
        attempted_publish = self.client.post(
            f"{endpoint}publish/",
            {},
            format="json",
        )
        self.assertEqual(attempted_publish.status_code, 403)

        self.client.force_authenticate(self.parent)
        response = self.client.get("/api/cms/students/")
        self.assertEqual(response.status_code, 403)
