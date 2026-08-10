import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.invitations import create_invitation, hash_token
from apps.accounts.models import UserInvitation, UserProfile


User = get_user_model()


class SetPasswordAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(username="gm-inviter", password="password123")
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        admin_profile.role = UserProfile.Role.GENERAL_MANAGER
        admin_profile.is_active = True
        admin_profile.save()

        self.invited_user = User.objects.create_user(
            username="invited-user",
            email="invited@example.com",
            password=None,
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.invited_user)
        profile.role = UserProfile.Role.UNIT_MEDIA
        profile.is_active = True
        profile.save()

    def test_valid_token_sets_password_and_can_only_be_used_once(self):
        invitation, raw_token = create_invitation(user=self.invited_user, created_by=self.admin)
        self.assertFalse(self.invited_user.has_usable_password())

        response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "BrandNewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 204)

        self.invited_user.refresh_from_db()
        self.assertTrue(self.invited_user.has_usable_password())
        self.assertTrue(self.invited_user.check_password("BrandNewStrongPass123!"))

        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.used_at)

        login_response = self.client.post(
            "/api/auth/login/",
            {"username": "invited-user", "password": "BrandNewStrongPass123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)

        # Replay of the exact same (now-consumed) token must never work again.
        replay_response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "AnotherStrongPass456!"},
            format="json",
        )
        self.assertEqual(replay_response.status_code, 400)
        self.assertIn("قبلاً استفاده", replay_response.data["token"][0])

        self.invited_user.refresh_from_db()
        self.assertTrue(self.invited_user.check_password("BrandNewStrongPass123!"))

    def test_invalid_token_is_rejected(self):
        response = self.client.post(
            "/api/auth/set-password/",
            {"token": "not-a-real-token", "password": "BrandNewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("نامعتبر", response.data["token"][0])

    def test_expired_token_is_rejected(self):
        raw_token = secrets.token_urlsafe(32)
        invitation = UserInvitation.objects.create(
            user=self.invited_user,
            created_by=self.admin,
            token_hash=hash_token(raw_token),
            expires_at=timezone.now() - timedelta(hours=1),
        )

        response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "BrandNewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("منقضی", response.data["token"][0])

        self.invited_user.refresh_from_db()
        self.assertFalse(self.invited_user.has_usable_password())
        invitation.refresh_from_db()
        self.assertIsNone(invitation.used_at)

    def test_already_used_token_is_rejected(self):
        invitation, raw_token = create_invitation(user=self.invited_user, created_by=self.admin)
        invitation.used_at = timezone.now()
        invitation.save(update_fields=["used_at"])

        response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "BrandNewStrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("قبلاً استفاده", response.data["token"][0])

    def test_weak_password_rejected_by_django_validators(self):
        invitation, raw_token = create_invitation(user=self.invited_user, created_by=self.admin)

        response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "12345678"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        invitation.refresh_from_db()
        self.assertIsNone(invitation.used_at)
        self.invited_user.refresh_from_db()
        self.assertFalse(self.invited_user.has_usable_password())


class CMSUserInvitationCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="gm-creator", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        profile.role = UserProfile.Role.GENERAL_MANAGER
        profile.is_active = True
        profile.save()

        login = self.client.post(
            "/api/auth/login/",
            {"username": "gm-creator", "password": "password123"},
            format="json",
        )
        self.access = login.data["access"]

    def test_create_user_issues_invitation_without_usable_password(self):
        response = self.client.post(
            "/api/cms/users/",
            {
                "username": "brand-new-user",
                "email": "brand-new@example.com",
                "full_name": "کاربر جدید",
                "role": UserProfile.Role.UNIT_MEDIA,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("invitation", response.data)
        self.assertTrue(response.data["invitation"]["token"])
        self.assertFalse(response.data["invitation"]["email_sent"])

        new_user = User.objects.get(username="brand-new-user")
        self.assertFalse(new_user.has_usable_password())
        self.assertEqual(UserInvitation.objects.filter(user=new_user).count(), 1)

        invitation = UserInvitation.objects.get(user=new_user)
        self.assertEqual(invitation.created_by_id, self.admin.id)

    def test_create_user_response_token_actually_works_end_to_end(self):
        create_response = self.client.post(
            "/api/cms/users/",
            {
                "username": "chained-user",
                "email": "chained-user@example.com",
                "full_name": "کاربر زنجیره‌ای",
                "role": UserProfile.Role.PARENT,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
            format="json",
        )
        raw_token = create_response.data["invitation"]["token"]

        set_password_response = self.client.post(
            "/api/auth/set-password/",
            {"token": raw_token, "password": "ChainedStrongPass789!"},
            format="json",
        )
        self.assertEqual(set_password_response.status_code, 204)

        login_response = self.client.post(
            "/api/auth/login/",
            {"username": "chained-user", "password": "ChainedStrongPass789!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)

    @override_settings(EMAIL_HOST="smtp.example.com")
    def test_create_user_sends_email_when_smtp_configured(self):
        mail.outbox = []

        response = self.client.post(
            "/api/cms/users/",
            {
                "username": "emailed-user",
                "email": "emailed-user@example.com",
                "full_name": "کاربر با ایمیل",
                "role": UserProfile.Role.UNIT_MEDIA,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["invitation"]["email_sent"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("emailed-user@example.com", mail.outbox[0].to)
        self.assertIn(response.data["invitation"]["token"], mail.outbox[0].body)

    def test_create_user_without_email_never_reports_email_sent(self):
        response = self.client.post(
            "/api/cms/users/",
            {
                "username": "no-email-user",
                "full_name": "کاربر بدون ایمیل",
                "role": UserProfile.Role.UNIT_MEDIA,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.access}",
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["invitation"]["email_sent"])
