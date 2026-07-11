from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile
from apps.contact.models import ContactMessage
from apps.gallery.models import GalleryItem
from apps.home.models import HomeSlide
from apps.registration.models import RegistrationRequest
from apps.units.models import SchoolUnit


User = get_user_model()


class FrontendBackendContractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user("manager", password="Old-password-123!")
        manager_profile = self.manager.profile
        manager_profile.role = UserProfile.Role.GENERAL_MANAGER
        manager_profile.full_name = "مدیر کل"
        manager_profile.save()
        self.unit = SchoolUnit.objects.create(
            title="واحد تست",
            slug="test-unit",
            kind=SchoolUnit.Kind.ELEMENTARY,
            gender=SchoolUnit.Gender.BOYS,
            is_active=True,
        )

    def authenticate_manager(self):
        self.client.force_authenticate(self.manager)

    def test_public_form_aliases_accept_exact_frontend_payloads(self):
        contact_response = self.client.post(
            "/api/contact/",
            {
                "name": "کاربر تست",
                "phone": "09120000000",
                "email": "",
                "subject": "موضوع تست",
                "message": "این متن پیام تستی معتبر است.",
            },
            format="json",
        )
        self.assertEqual(contact_response.status_code, 201, contact_response.data)
        self.assertEqual(ContactMessage.objects.get().full_name, "کاربر تست")

        registration_response = self.client.post(
            "/api/registration/",
            {
                "full_name": "دانش‌آموز تست",
                "parent_phone": "09121111111",
                "requested_grade": "اول",
                "unit_id": str(self.unit.id),
                "description": "توضیح",
            },
            format="json",
        )
        self.assertEqual(registration_response.status_code, 201, registration_response.data)
        registration = RegistrationRequest.objects.get()
        self.assertEqual(registration.student_full_name, "دانش‌آموز تست")
        self.assertIsNone(registration.parent_full_name)
        self.assertEqual(registration.requested_unit, self.unit)

    def test_frontend_url_media_and_unified_content_contract(self):
        self.authenticate_manager()

        unit_response = self.client.patch(
            f"/api/cms/units/{self.unit.id}/",
            {"cover_image": "/images/unit-cover.jpg"},
            format="json",
        )
        self.assertEqual(unit_response.status_code, 200, unit_response.data)
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.cover_image_url, "/images/unit-cover.jpg")

        slide_response = self.client.post(
            "/api/cms/home-slides/",
            {
                "image": "/images/home-slider/slide.jpg",
                "title": "اسلاید تست",
                "subtitle": None,
                "href": "/news",
                "is_active": True,
                "order": 1,
            },
            format="json",
        )
        self.assertEqual(slide_response.status_code, 201, slide_response.data)
        self.assertEqual(HomeSlide.objects.get().image_url, "/images/home-slider/slide.jpg")

        gallery_response = self.client.post(
            "/api/cms/gallery/",
            {
                "title": "مدیای تست",
                "image": "/media/video/test.mp4",
                "album": "آلبوم تست",
                "scope": "school",
                "unit_id": None,
                "status": "published",
            },
            format="json",
        )
        self.assertEqual(gallery_response.status_code, 201, gallery_response.data)
        gallery = GalleryItem.objects.get()
        self.assertEqual(gallery.media_url, "/media/video/test.mp4")
        self.assertEqual(gallery.album, "آلبوم تست")

        content_response = self.client.post(
            "/api/cms/content/",
            {
                "kind": "news",
                "title": "خبر قرارداد",
                "slug": "contract-news",
                "summary": "خلاصه خبر",
                "body_html": "<p>متن کامل خبر</p>",
                "cover_image": "/images/news.jpg",
                "scope": "school",
                "unit_id": None,
                "category": "فرهنگی",
                "status": "published",
                "author_role": "general_manager",
                "published_at": "2026-07-11T08:00:00.000Z",
            },
            format="json",
        )
        self.assertEqual(content_response.status_code, 201, content_response.data)
        self.assertTrue(content_response.data["id"].startswith("news-"))
        self.assertEqual(content_response.data["body_html"], "<p>متن کامل خبر</p>")

        self.client.force_authenticate(user=None)
        anonymous_content = self.client.get("/api/cms/content/")
        self.assertEqual(anonymous_content.status_code, 200)
        self.assertEqual(anonymous_content.data[0]["kind"], "news")
        self.assertEqual(anonymous_content.data[0]["cover_image"], "/images/news.jpg")

    def test_missing_cms_repository_paths_support_crud(self):
        self.authenticate_manager()

        department = self.client.post(
            "/api/cms/departments/",
            {
                "title": "دپارتمان تست",
                "slug": "test-department",
                "description": "توضیح",
                "cover_image": "/images/department.jpg",
                "is_active": True,
                "order": 1,
            },
            format="json",
        )
        self.assertEqual(department.status_code, 201, department.data)

        created_user = self.client.post(
            "/api/cms/users/",
            {
                "username": "parent-user",
                "full_name": "ولی تست",
                "email": None,
                "phone": "09123333333",
                "role": "parent",
                "unit_id": None,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created_user.status_code, 201, created_user.data)

        for path, payload in (
            (
                "/api/cms/students/",
                {
                    "full_name": "دانش‌آموز پنل",
                    "national_code": None,
                    "unit_id": self.unit.id,
                    "class_title": "۱۰۱",
                    "parent_id": created_user.data["id"],
                },
            ),
            (
                "/api/cms/classes/",
                {"title": "کلاس ۱۰۱", "unit_id": self.unit.id, "grade": "اول", "capacity": 25},
            ),
            (
                "/api/cms/programs/",
                {"title": "برنامه تست", "description": "توضیح", "unit_id": self.unit.id, "date": "۱۴۰۵/۰۴/۲۰"},
            ),
        ):
            response = self.client.post(path, payload, format="json")
            self.assertEqual(response.status_code, 201, (path, response.data))
            self.assertIn("created_at", response.data)

        message_response = self.client.post(
            "/api/cms/internal-messages/",
            {
                "sender_id": "ignored-by-server",
                "sender_name": "ignored-by-server",
                "sender_role": "general_manager",
                "recipient_id": created_user.data["id"],
                "recipient_name": "ignored-by-server",
                "recipient_role": "parent",
                "subject": "پیام تست",
                "body": "متن پیام داخلی",
                "is_read": False,
                "unit_id": None,
            },
            format="json",
        )
        self.assertEqual(message_response.status_code, 201, message_response.data)
        self.assertEqual(message_response.data["sender_id"], "user-manager")
        self.assertEqual(message_response.data["recipient_id"], "user-parent-user")

        static_page = self.client.post(
            "/api/cms/static-pages/",
            {
                "slug": "about",
                "title": "درباره ما",
                "body_html": "<p>درباره مجموعه</p>",
                "meta_description": "معرفی",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(static_page.status_code, 201, static_page.data)

    def test_frontend_password_confirmation_name_is_supported(self):
        self.authenticate_manager()
        response = self.client.post(
            "/api/me/change-password/",
            {
                "current_password": "Old-password-123!",
                "new_password": "New-password-456!",
                "confirm_password": "New-password-456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 204, response.data)
