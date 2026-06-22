import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.units.models import SchoolUnit

from .models import UserProfile, UserUnitMembership


User = get_user_model()


TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_avatar_image(name="avatar.webp", image_format="WEBP", content_type="image/webp"):
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
class AccountsAuthTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username="manager",
            password="password123",
            email="manager@example.com",
        )

        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.profile.role = UserProfile.Role.GENERAL_MANAGER
        self.profile.full_name = "مدیر کل"
        self.profile.is_active = True
        self.profile.save()

    def login(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "manager",
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        return response.data

    def test_login_returns_tokens_and_user_payload(self):
        data = self.login()

        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["username"], "manager")
        self.assertEqual(data["user"]["role"], UserProfile.Role.GENERAL_MANAGER)
        self.assertEqual(data["redirect_path"], "/admin")

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "manager",
                "password": "wrong-password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_inactive_profile_cannot_login(self):
        self.profile.is_active = False
        self.profile.save(update_fields=["is_active"])

        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "manager",
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_refresh_token_returns_new_access_token(self):
        data = self.login()

        response = self.client.post(
            "/api/auth/refresh/",
            {
                "refresh": data["refresh"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_logout_blacklists_refresh_token(self):
        data = self.login()

        response = self.client.post(
            "/api/auth/logout/",
            {
                "refresh": data["refresh"],
            },
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
            format="json",
        )

        self.assertEqual(response.status_code, 204)

    def test_me_requires_authentication(self):
        response = self.client.get("/api/me/")

        self.assertEqual(response.status_code, 401)

    def test_get_me_returns_current_user(self):
        data = self.login()

        response = self.client.get(
            "/api/me/",
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "manager")
        self.assertEqual(response.data["role"], UserProfile.Role.GENERAL_MANAGER)

    def test_get_profile(self):
        data = self.login()

        response = self.client.get(
            "/api/me/profile/",
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "manager")
        self.assertEqual(response.data["full_name"], "مدیر کل")

    def test_update_profile(self):
        data = self.login()

        response = self.client.patch(
            "/api/me/profile/",
            {
                "full_name": "نام جدید",
                "phone": "09120000000",
                "email": "new@example.com",
                "description": "توضیحات جدید",
            },
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "نام جدید")
        self.assertEqual(response.data["phone"], "09120000000")
        self.assertEqual(response.data["email"], "new@example.com")

        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.email, "new@example.com")
        self.assertEqual(self.profile.full_name, "نام جدید")

    def test_upload_avatar(self):
        data = self.login()
        avatar = make_avatar_image()

        response = self.client.post(
            "/api/me/profile/avatar/",
            {
                "avatar": avatar,
            },
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["avatar"])

    def test_reject_invalid_avatar_upload(self):
        data = self.login()

        invalid_file = SimpleUploadedFile(
            "avatar.txt",
            b"not an image",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/me/profile/avatar/",
            {
                "avatar": invalid_file,
            },
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_get_permissions(self):
        data = self.login()

        response = self.client.get(
            "/api/me/permissions/",
            HTTP_AUTHORIZATION=f"Bearer {data['access']}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.GENERAL_MANAGER)
        self.assertTrue(response.data["permissions"]["can_manage_all_units"])
        self.assertTrue(response.data["permissions"]["can_publish_content"])


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class UserUnitsTests(TestCase):
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

    def test_general_manager_gets_all_active_units(self):
        user = User.objects.create_user(
            username="general",
            password="password123",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()

        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "general",
                "password": "password123",
            },
            format="json",
        )

        access = login_response.data["access"]

        response = self.client.get(
            "/api/me/units/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_unit_manager_gets_only_membership_units(self):
        user = User.objects.create_user(
            username="unitmanager",
            password="password123",
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.UNIT_MANAGER
        profile.is_active = True
        profile.save()

        UserUnitMembership.objects.create(
            user=user,
            unit=self.unit_1,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "unitmanager",
                "password": "password123",
            },
            format="json",
        )

        access = login_response.data["access"]

        response = self.client.get(
            "/api/me/units/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.unit_1.id)
        self.assertEqual(response.data[0]["access_role"], UserUnitMembership.UnitRole.UNIT_MANAGER)