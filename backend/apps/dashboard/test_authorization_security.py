"""Object-level authorization (IDOR) tests for the Parent panel.

Written as part of the ASVS/authorization audit in docs/security/. Prior
coverage exercised same-role/other-unit access (see
apps.gallery.tests.test_unit_media_cannot_create_gallery_item_for_other_unit
and apps.dashboard.tests.test_unit_manager_cannot_access_other_unit_dashboard)
but nothing exercised the parent-to-parent case: whether one parent account
can read another parent's child record by guessing/incrementing the child's
primary key. ParentChildDetailAPIView's get_queryset() scopes to
`parent=request.user` before filtering by pk, which reads as correct, but
per the audit's own standard this must be proven by a real request, not
just a code read.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.units.models import SchoolUnit

from .models import Student

User = get_user_model()


class ParentChildIDORTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.unit = SchoolUnit.objects.create(
            title="دبستان",
            slug="idor-test-unit",
            is_active=True,
            order=1,
        )

        # UserProfile is auto-created with role=PARENT (the model default)
        # by apps.accounts.signals.create_user_profile on User creation.
        self.parent_a = User.objects.create_user(username="idor_parent_a", password="Str0ng!Passw0rd")
        self.parent_b = User.objects.create_user(username="idor_parent_b", password="Str0ng!Passw0rd")

        self.child_of_a = Student.objects.create(
            full_name="فرزند والد الف",
            unit=self.unit,
            parent=self.parent_a,
        )
        self.child_of_b = Student.objects.create(
            full_name="فرزند والد ب",
            unit=self.unit,
            parent=self.parent_b,
        )

    def test_parent_cannot_read_another_parents_child_by_id(self):
        """Attack: parent_b, authenticated, requests parent_a's child by
        guessing/incrementing its known primary key."""
        self.client.force_authenticate(user=self.parent_b)

        response = self.client.get(f"/api/parents/children/{self.child_of_a.pk}/")

        self.assertEqual(
            response.status_code,
            404,
            "IDOR: an authenticated parent could read another parent's child "
            "record by ID. Expected a 404 (object-level authorization should "
            "make the record invisible, not a 403 that would confirm the ID "
            "exists).",
        )

    def test_parent_can_read_their_own_child_by_id(self):
        """Sanity check: the fix for the above must not also break the
        legitimate case."""
        self.client.force_authenticate(user=self.parent_a)

        response = self.client.get(f"/api/parents/children/{self.child_of_a.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.child_of_a.pk)

    def test_parent_children_list_excludes_other_parents_children(self):
        """Attack: parent_b lists /api/parents/children/ and checks whether
        the list endpoint itself leaks other parents' children (a second,
        independent way the same IDOR class could surface)."""
        self.client.force_authenticate(user=self.parent_b)

        response = self.client.get("/api/parents/children/")

        self.assertEqual(response.status_code, 200)
        returned_ids = {item["id"] for item in response.data}
        self.assertNotIn(
            self.child_of_a.pk,
            returned_ids,
            "IDOR: the parent children list endpoint returned another "
            "parent's child record.",
        )
        self.assertIn(self.child_of_b.pk, returned_ids)

    def test_unauthenticated_request_is_rejected(self):
        """Baseline: this endpoint must require authentication at all --
        confirms the DRF default IsAuthenticated posture actually applies
        here and hasn't been accidentally overridden to AllowAny."""
        response = self.client.get(f"/api/parents/children/{self.child_of_a.pk}/")

        self.assertIn(response.status_code, (401, 403))
