"""Object-level authorization (IDOR / cross-unit takeover) tests for the
generic CMS content endpoint (`CMSContentViewSet` in apps/content/cms.py),
which backs both News and Announcement editing.

Written to prove a specific attack: `_update()` fetches the target content
item by raw primary key with no unit-ownership filter
(`model.objects.filter(pk=object_id).first()`), then authorizes the write
via `_validated_values()`, which resolves `scope`/`unit_id` from the
*request body* (falling back to the item's real value only when the
payload omits the field) before checking `_ensure_write_access`. A unit
manager/media user can therefore PATCH another unit's content by simply
including `unit_id` for a unit they *do* legitimately manage in the
payload -- the access check passes against that claimed unit, not the
target object's actual unit, and the object is both overwritten and
literally reassigned into the attacker's unit.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.news.models import News
from apps.units.models import SchoolUnit

User = get_user_model()


class CMSContentCrossUnitAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit_a = SchoolUnit.objects.create(
            title="واحد الف", slug="cms-authz-unit-a", is_active=True, order=1,
        )
        self.unit_b = SchoolUnit.objects.create(
            title="واحد ب", slug="cms-authz-unit-b", is_active=True, order=2,
        )

        self.manager_a = self.create_user("cms_authz_manager_a", UserProfile.Role.UNIT_MANAGER)
        UserUnitMembership.objects.create(
            user=self.manager_a,
            unit=self.unit_a,
            role=UserUnitMembership.UnitRole.UNIT_MANAGER,
            is_active=True,
        )

        self.news_b = News.objects.create(
            title="خبر اصلی واحد ب",
            scope=News.Scope.UNIT,
            unit=self.unit_b,
            status=News.Status.DRAFT,
        )
        self.news_a = News.objects.create(
            title="خبر اصلی واحد الف",
            scope=News.Scope.UNIT,
            unit=self.unit_a,
            status=News.Status.DRAFT,
        )

    def create_user(self, username, role):
        user = User.objects.create_user(
            username=username, password="Str0ng!Passw0rd", email=f"{username}@example.com",
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.save()
        return user

    def test_unit_manager_cannot_hijack_another_units_content_via_payload_unit_id(self):
        """Attack: manager_a (Unit A only) PATCHes Unit B's news item by its
        known ID, supplying `unit_id` for their own unit (Unit A) in the
        payload -- an attempt to pass the object-level access check using a
        unit they legitimately manage, rather than the item's real unit."""
        self.client.force_authenticate(user=self.manager_a)

        response = self.client.patch(
            f"/api/cms/content/news-{self.news_b.pk}/",
            {"unit_id": self.unit_a.id, "title": "محتوای دزدیده‌شده"},
            format="json",
        )

        self.assertIn(
            response.status_code,
            (403, 404),
            "Cross-unit CMS takeover: a Unit A manager was able to PATCH "
            "Unit B's content by supplying their own unit_id in the "
            f"payload (got HTTP {response.status_code}).",
        )

        self.news_b.refresh_from_db()
        self.assertEqual(
            self.news_b.title,
            "خبر اصلی واحد ب",
            "Unit B's content title was modified by a Unit A manager.",
        )
        self.assertEqual(
            self.news_b.unit_id,
            self.unit_b.id,
            "Unit B's content was reassigned to Unit A by a Unit A manager.",
        )

    def test_unit_manager_cannot_patch_other_units_content_without_supplying_unit_id(self):
        """Baseline companion case: omitting unit_id from the payload was
        already correctly rejected (falls back to the item's real unit) --
        must still be rejected after the fix."""
        self.client.force_authenticate(user=self.manager_a)

        response = self.client.patch(
            f"/api/cms/content/news-{self.news_b.pk}/",
            {"title": "تلاش دیگر"},
            format="json",
        )

        self.assertIn(response.status_code, (403, 404))
        self.news_b.refresh_from_db()
        self.assertEqual(self.news_b.title, "خبر اصلی واحد ب")

    def test_unit_manager_can_still_update_their_own_units_content(self):
        """The fix must not break the legitimate case: a Unit A manager
        editing Unit A's own content, including re-affirming unit_id."""
        self.client.force_authenticate(user=self.manager_a)

        response = self.client.patch(
            f"/api/cms/content/news-{self.news_a.pk}/",
            {"unit_id": self.unit_a.id, "title": "ویرایش مجاز", "version": self.news_a.version},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data if hasattr(response, "data") else response.content)
        self.news_a.refresh_from_db()
        self.assertEqual(self.news_a.title, "ویرایش مجاز")
        self.assertEqual(self.news_a.unit_id, self.unit_a.id)
