"""STUDENT-CONCURRENCY-001 regression: two concurrent partial PATCH
requests to the same Student must not silently lose one of them.

Reproduced (independently, via a real controlled direct-API schedule)
this session: a joint parent+unit transfer PATCH (A/A -> B/B) racing a
second, stale PATCH that only touches parent_id and still names the
pre-transfer parent (A) both validated successfully (both 200) -- both
requests read the student row before the transfer committed, so both
validated against the same pre-transfer snapshot. Whichever request's
Model.save() ran last silently reverted the other's already-committed
change: Django's default ModelSerializer.update() calls instance.save()
with no update_fields, so it rewrites *every* column from that request's
in-memory instance, including unit_id, even though the stale request's
payload never mentioned unit_id at all.

The fix (see CMSStudentViewSet.get_queryset()/update() in
apps/dashboard/cms_views.py) takes a select_for_update() row lock on the
target Student in get_object(), held for the whole request via
transaction.atomic(), so two concurrent updates to the same student are
serialized: the second request's read (and therefore its validation)
happens only after the first has committed, against current data -- not
a stale pre-transfer snapshot. That can correctly cause the second
request to now be rejected (its transfer target may no longer be valid
against the pairing the first request just committed); that is the
intended, non-silent outcome.

Requires TransactionTestCase (not TestCase): the two request threads use
independent DB connections that must actually see each other's committed
state, and -- with the fix in place -- must actually block on each
other's row lock, neither of which works inside TestCase's single
wrapping transaction.
"""

import threading
import time
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, UserUnitMembership
from apps.units.models import SchoolUnit

from .cms_views import CMSStudentViewSet
from .models import Student

User = get_user_model()


class StudentConcurrentPatchRaceTests(TransactionTestCase):
    def setUp(self):
        self.unit_a = SchoolUnit.objects.create(
            title="واحد آ", slug="student-concurrency-unit-a", is_active=True, order=1,
        )
        self.unit_b = SchoolUnit.objects.create(
            title="واحد ب", slug="student-concurrency-unit-b", is_active=True, order=2,
        )

        self.manager = self.create_user("stuconc-manager", UserProfile.Role.UNIT_MANAGER)
        for unit in (self.unit_a, self.unit_b):
            UserUnitMembership.objects.create(
                user=self.manager, unit=unit,
                role=UserUnitMembership.UnitRole.UNIT_MANAGER, is_active=True,
            )

        # parent_a is a recognized parent of unit_a ONLY.
        self.parent_a = self.create_user("stuconc-parent-a", UserProfile.Role.PARENT)
        UserUnitMembership.objects.create(
            user=self.parent_a, unit=self.unit_a,
            role=UserUnitMembership.UnitRole.PARENT, is_active=True,
        )

        # parent_b is a recognized parent of unit_b ONLY.
        self.parent_b = self.create_user("stuconc-parent-b", UserProfile.Role.PARENT)
        UserUnitMembership.objects.create(
            user=self.parent_b, unit=self.unit_b,
            role=UserUnitMembership.UnitRole.PARENT, is_active=True,
        )

        self.student = Student.objects.create(
            full_name="دانش‌آموز رقابتی",
            unit=self.unit_a,
            parent=self.parent_a,
        )

    @staticmethod
    def create_user(username, role):
        user = User.objects.create_user(
            username=username, password="password123", email=f"{username}@example.com",
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_active = True
        profile.full_name = username
        profile.save()
        return user

    def test_stale_patch_cannot_silently_revert_a_concurrently_committed_transfer(self):
        student_id = self.student.pk

        lock_acquired = threading.Event()

        def delayed_perform_update(view_self, serializer):
            # Mirrors UpdateModelMixin.perform_update's real body
            # (`serializer.save()`), but -- only for the joint
            # parent+unit transfer request -- signals right after this
            # view's transaction.atomic()/select_for_update() has
            # already locked the row (perform_update runs after
            # get_object() and is_valid()) and sleeps before saving, so
            # the racing stale PATCH is guaranteed to attempt its own
            # select_for_update() while this transaction still holds
            # the lock, on every run, deterministically.
            if "unit" in serializer.validated_data:
                lock_acquired.set()
                time.sleep(0.3)
            serializer.save()

        results = {}

        def do_transfer():
            try:
                client = APIClient()
                client.force_authenticate(user=self.manager)
                response = client.patch(
                    f"/api/cms/students/{student_id}/",
                    {"parent_id": self.parent_b.pk, "unit_id": self.unit_b.pk},
                    format="json",
                )
                results["transfer_status"] = response.status_code
                results["transfer_data"] = response.data
            finally:
                connection.close()

        def do_stale_parent_only_patch():
            try:
                # Only fire once the transfer thread has locked the row
                # -- guarantees this PATCH attempts its own
                # select_for_update() while that lock is still held,
                # instead of relying on scheduling luck.
                self.assertTrue(lock_acquired.wait(timeout=5), "lock signal never fired")
                client = APIClient()
                client.force_authenticate(user=self.manager)
                response = client.patch(
                    f"/api/cms/students/{student_id}/",
                    {"parent_id": self.parent_a.pk},
                    format="json",
                )
                results["stale_status"] = response.status_code
                results["stale_data"] = response.data
            finally:
                connection.close()

        with mock.patch.object(CMSStudentViewSet, "perform_update", delayed_perform_update):
            thread_transfer = threading.Thread(target=do_transfer)
            thread_stale = threading.Thread(target=do_stale_parent_only_patch)
            thread_transfer.start()
            thread_stale.start()
            thread_transfer.join(timeout=15)
            thread_stale.join(timeout=15)

        self.assertFalse(thread_transfer.is_alive(), "transfer thread never finished (deadlock?)")
        self.assertFalse(thread_stale.is_alive(), "stale-patch thread never finished (deadlock?)")
        self.assertIn("transfer_status", results, "transfer request never completed")
        self.assertIn("stale_status", results, "stale request never completed")

        # The joint transfer, validated against the pre-race state, must
        # succeed.
        self.assertEqual(results["transfer_status"], 200, results.get("transfer_data"))

        self.student.refresh_from_db()

        if results["stale_status"] == 200:
            # This is the PRE-FIX branch: without the row lock, the
            # stale PATCH validated against the pre-transfer snapshot
            # (parent_a was a recognized parent of the OLD unit, unit_a)
            # and was wrongly allowed to overwrite the committed
            # transfer -- the exact silent lost update this regression
            # test exists to catch. Fail loudly instead of silently
            # accepting a reverted student record.
            self.fail(
                "STUDENT-CONCURRENCY-001 regression: the stale parent-only "
                "PATCH (still naming the pre-transfer parent) was accepted "
                "and silently reverted the concurrently committed "
                f"transfer. Final state: parent_id={self.student.parent_id}, "
                f"unit_id={self.student.unit_id} (expected parent_id="
                f"{self.parent_b.pk}, unit_id={self.unit_b.pk})."
            )

        # Post-fix, this is the branch that is hit: the racing stale
        # PATCH blocks on the transfer's row lock and, once unblocked,
        # re-validates against the by-then-committed transfer -- parent_a
        # is no longer a recognized parent of the student's (new) unit,
        # so it is correctly rejected.
        self.assertEqual(results["stale_status"], 400, results.get("stale_data"))

        # Either way the assertions above didn't already fail: the
        # transfer committed by the first request must still be intact
        # -- not silently reverted.
        self.assertEqual(self.student.parent_id, self.parent_b.pk)
        self.assertEqual(self.student.unit_id, self.unit_b.pk)
