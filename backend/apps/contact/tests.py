from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile

from apps.contact.models import ContactInfo, ContactMessage


User = get_user_model()


class ContactPublicAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_contact_info_returns_empty_payload_when_no_active_contact_info_exists(self):
        response = self.client.get("/api/contact/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "تماس با ما")
        self.assertIsNone(response.data["address"])
        self.assertIsNone(response.data["phone"])
        self.assertIsNone(response.data["email"])
        self.assertIsNone(response.data["map_url"])

    def test_contact_info_returns_active_contact_info(self):
        ContactInfo.objects.create(
            title="تماس با مدرسه",
            description="راه‌های ارتباطی",
            address="تهران",
            phone="02100000000",
            email="info@example.com",
            map_url="https://example.com/map",
            is_active=True,
        )

        response = self.client.get("/api/contact/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "تماس با مدرسه")
        self.assertEqual(response.data["address"], "تهران")
        self.assertEqual(response.data["phone"], "02100000000")
        self.assertEqual(response.data["email"], "info@example.com")
        self.assertEqual(response.data["map_url"], "https://example.com/map")

    def test_can_create_contact_message_with_phone(self):
        payload = {
            "full_name": "علی رضایی",
            "phone": "09120000000",
            "subject": "سؤال",
            "message": "این یک پیام تستی برای مدرسه است.",
        }

        response = self.client.post("/api/messages/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)
        self.assertEqual(response.data["message"], "پیام شما با موفقیت ثبت شد.")

    def test_can_create_contact_message_with_email(self):
        payload = {
            "full_name": "علی رضایی",
            "email": "ali@example.com",
            "subject": "سؤال",
            "message": "این یک پیام تستی برای مدرسه است.",
        }

        response = self.client.post("/api/messages/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_contact_message_requires_phone_or_email(self):
        payload = {
            "full_name": "علی رضایی",
            "subject": "سؤال",
            "message": "این یک پیام تستی برای مدرسه است.",
        }

        response = self.client.post("/api/messages/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)
        self.assertIn("email", response.data)

    def test_contact_message_requires_minimum_message_length(self):
        payload = {
            "full_name": "علی رضایی",
            "phone": "09120000000",
            "subject": "سؤال",
            "message": "کوتاه",
        }

        response = self.client.post("/api/messages/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("message", response.data)


class ContactCMSAPITests(TestCase):
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

        self.message = ContactMessage.objects.create(
            full_name="علی رضایی",
            phone="09120000000",
            subject="سؤال",
            message="این یک پیام تستی برای مدرسه است.",
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

    def test_general_manager_can_list_messages(self):
        self.authenticate(self.general_manager)

        response = self.client.get("/api/cms/messages/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_parent_cannot_list_messages(self):
        self.authenticate(self.parent)

        response = self.client.get("/api/cms/messages/")

        self.assertEqual(response.status_code, 403)

    def test_general_manager_can_retrieve_message(self):
        self.authenticate(self.general_manager)

        response = self.client.get(f"/api/cms/messages/{self.message.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "علی رضایی")

    def test_general_manager_can_update_message_status(self):
        self.authenticate(self.general_manager)

        response = self.client.patch(
            f"/api/cms/messages/{self.message.id}/",
            {
                "status": ContactMessage.Status.SEEN,
                "admin_note": "بررسی شد",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.message.refresh_from_db()
        self.assertEqual(self.message.status, ContactMessage.Status.SEEN)
        self.assertEqual(self.message.admin_note, "بررسی شد")

    def test_anonymous_cannot_list_messages(self):
        response = self.client.get("/api/cms/messages/")

        self.assertEqual(response.status_code, 401)