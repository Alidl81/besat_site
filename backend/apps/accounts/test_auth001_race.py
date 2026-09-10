"""AUTH-001 regression: a refresh request racing a password change must
not be able to mint a descendant refresh token that survives the change.

revoke_all_outstanding_tokens() (apps.accounts.serializers) reads an
unlocked snapshot of OutstandingToken rows for a user, then bulk-inserts
BlacklistedToken rows for that snapshot. Without additional locking, a
concurrent refresh request (SIMPLE_JWT's rotation, hitting
RefreshTokenAPIView) can mint a brand-new descendant refresh token in the
gap between that snapshot read and the blacklist insert -- a descendant
that was never in the snapshot and would survive the password change
indefinitely. The fix serializes the two code paths on a per-user
UserProfile row lock: see the `select_for_update()` calls in
ChangePasswordSerializer.save()/SetPasswordSerializer.save() and
RefreshTokenSerializer.validate() in apps/accounts/serializers.py.

This test reproduces the exact vulnerable window deterministically
rather than depending on real thread-scheduling luck: it patches
revoke_all_outstanding_tokens so that, immediately after taking its
OutstandingToken snapshot, it signals a threading.Event and then sleeps
briefly before inserting the blacklist rows for that snapshot. The
concurrent refresh request is only sent once that signal fires, which
guarantees it is issued at the precise moment the snapshot has already
been read but the blacklist insert has not happened yet -- exactly the
gap the bug docstring describes.

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
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts import serializers as accounts_serializers
from apps.accounts.models import UserProfile


User = get_user_model()


class ChangePasswordVsConcurrentRefreshRaceTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="auth001-race",
            password="password123",
            email="auth001-race@example.com",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.profile.is_active = True
        self.profile.save()

    def _login(self):
        client = APIClient()
        response = client.post(
            "/api/auth/login/",
            {"username": "auth001-race", "password": "password123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_concurrent_refresh_cannot_outlive_password_change(self):
        pre_change = self._login()

        snapshot_taken = threading.Event()

        def delayed_revoke(user):
            # Mirrors revoke_all_outstanding_tokens()'s real body, but
            # signals right after the snapshot read and sleeps before the
            # blacklist insert -- opening the exact window the bug
            # describes, on every run, deterministically.
            outstanding_tokens = list(OutstandingToken.objects.filter(user=user))
            snapshot_taken.set()
            time.sleep(0.3)
            BlacklistedToken.objects.bulk_create(
                (
                    BlacklistedToken(token=token)
                    for token in outstanding_tokens
                    if not hasattr(token, "blacklistedtoken")
                ),
                ignore_conflicts=True,
            )

        results = {}

        def do_change_password():
            try:
                client = APIClient()
                response = client.post(
                    "/api/me/change-password/",
                    {
                        "current_password": "password123",
                        "new_password": "newStrongPassword123!",
                        "new_password_confirm": "newStrongPassword123!",
                    },
                    HTTP_AUTHORIZATION=f"Bearer {pre_change['access']}",
                    format="json",
                )
                results["change_password_status"] = response.status_code
            finally:
                connection.close()

        def do_refresh():
            try:
                # Only fire once the password-change thread has taken its
                # snapshot -- guarantees this refresh lands in the
                # vulnerable gap instead of relying on scheduling luck.
                self.assertTrue(snapshot_taken.wait(timeout=5), "snapshot signal never fired")
                client = APIClient()
                response = client.post(
                    "/api/auth/refresh/",
                    {"refresh": pre_change["refresh"]},
                    format="json",
                )
                results["refresh_status"] = response.status_code
                results["refresh_data"] = response.data
            finally:
                connection.close()

        with mock.patch.object(
            accounts_serializers,
            "revoke_all_outstanding_tokens",
            side_effect=delayed_revoke,
        ):
            thread_a = threading.Thread(target=do_change_password)
            thread_b = threading.Thread(target=do_refresh)
            thread_a.start()
            thread_b.start()
            thread_a.join(timeout=15)
            thread_b.join(timeout=15)

        self.assertFalse(thread_a.is_alive(), "password-change thread never finished (deadlock?)")
        self.assertFalse(thread_b.is_alive(), "refresh thread never finished (deadlock?)")
        self.assertEqual(results.get("change_password_status"), 204, results)
        self.assertIn("refresh_status", results, "refresh request never completed")

        if results["refresh_status"] == 200:
            # Pre-fix, this is the branch that is hit: the racing refresh
            # succeeded and minted a descendant refresh token before the
            # password change's blacklist insert ran, so it wasn't in that
            # snapshot. Assert that descendant cannot itself still be used
            # -- i.e. it must not have survived the password change.
            descendant_refresh = results["refresh_data"]["refresh"]
            survive_check = APIClient().post(
                "/api/auth/refresh/",
                {"refresh": descendant_refresh},
                format="json",
            )
            self.assertEqual(
                survive_check.status_code,
                401,
                "AUTH-001: a refresh token minted by a request racing the "
                "password change survived it.",
            )
        else:
            # Post-fix, this is the branch that is hit: the racing
            # refresh blocks on the same row lock as the password change
            # and, once unblocked, re-verifies the (by then blacklisted)
            # pre-change token from scratch and is correctly rejected.
            self.assertEqual(results["refresh_status"], 401, results)

        # Either way, the original pre-change refresh token must be dead
        # once both requests have settled.
        final_check = APIClient().post(
            "/api/auth/refresh/",
            {"refresh": pre_change["refresh"]},
            format="json",
        )
        self.assertEqual(final_check.status_code, 401, final_check.data)
