import inspect

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import public_registration
from apps.accounts.models import UserProfile

User = get_user_model()

VALID_PAYLOAD = {
    "full_name": "زهرا احمدی",
    "email": "zahra.ahmadi@example.com",
    "phone": "09121234567",
    "password": "S3cure-Pass!23",
    "password_confirm": "S3cure-Pass!23",
}


class PublicCustomerRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_registration_creates_active_parent_account_atomically(self):
        response = self.client.post("/api/auth/register/", VALID_PAYLOAD, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="zahra.ahmadi@example.com")
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password(VALID_PAYLOAD["password"]))

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.role, UserProfile.Role.PARENT)
        self.assertEqual(profile.full_name, "زهرا احمدی")
        self.assertTrue(profile.is_active)

    def test_response_shape_matches_login_response(self):
        response = self.client.post("/api/auth/register/", VALID_PAYLOAD, format="json")

        for key in ("refresh", "access", "user", "redirect_path"):
            self.assertIn(key, response.data)
        self.assertEqual(response.data["user"]["role"], UserProfile.Role.PARENT)
        self.assertEqual(response.data["redirect_path"], "/dashboard/parents")

    def test_issued_access_token_authenticates_subsequent_requests(self):
        response = self.client.post("/api/auth/register/", VALID_PAYLOAD, format="json")
        access_token = response.data["access"]

        me_response = self.client.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {access_token}")

        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data["role"], UserProfile.Role.PARENT)

    def test_duplicate_email_is_rejected(self):
        self.client.post("/api/auth/register/", VALID_PAYLOAD, format="json")

        second = dict(VALID_PAYLOAD, phone="09120000001")
        response = self.client.post("/api/auth/register/", second, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertEqual(User.objects.filter(email="zahra.ahmadi@example.com").count(), 1)

    def test_password_mismatch_is_rejected(self):
        payload = dict(VALID_PAYLOAD, password_confirm="something-else")
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email=VALID_PAYLOAD["email"]).exists())

    def test_weak_password_is_rejected_by_django_validators(self):
        payload = dict(VALID_PAYLOAD, password="12345678", password_confirm="12345678")
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email=VALID_PAYLOAD["email"]).exists())

    def test_registration_never_grants_a_cms_role(self):
        response = self.client.post("/api/auth/register/", VALID_PAYLOAD, format="json")
        self.assertEqual(response.data["user"]["role"], UserProfile.Role.PARENT)
        self.assertNotIn(
            response.data["user"]["role"],
            (UserProfile.Role.GENERAL_MANAGER, UserProfile.Role.UNIT_MANAGER, UserProfile.Role.UNIT_MEDIA),
        )

    def test_module_does_not_import_the_invitation_system(self):
        """Decision #1 was explicit: this path must not touch the
        staff-invitation flow at all. Checked at the import level (not by
        scanning for the word "invitation", which legitimately appears in
        this module's own docstring explaining that exact constraint)."""
        source = inspect.getsource(public_registration)
        self.assertNotIn("from .invitations", source)
        self.assertNotIn("import invitations", source)
        self.assertFalse(hasattr(public_registration, "find_invitation"))
        self.assertFalse(hasattr(public_registration, "UserInvitation"))
