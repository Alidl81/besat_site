"""AUTH-001-FORCE-RESET-RACE regression: `manage.py ensure_cms_admin
--force-reset` racing a concurrent `/api/auth/refresh/` must not let a
newly-rotated descendant token survive the reset -- the exact AUTH-001
race `test_auth001_race.py` already covers for the self-service
change-password and invitation-acceptance paths, reproduced here for this
third caller of `revoke_all_outstanding_tokens()`.

Before this fix, `ensure_cms_admin.py` called `revoke_all_outstanding_
tokens(user)` directly, without first acquiring the per-user
`UserProfile.select_for_update()` row lock every other caller holds (see
that function's own docstring). A concurrent refresh landing between the
snapshot read and the blacklist insert could mint a descendant refresh
token that was never in the snapshot and would outlive the force-reset
indefinitely -- exactly the scenario a force-reset exists to prevent
(recovering a compromised admin account).

Requires TransactionTestCase for the same reason as test_auth001_race.py:
the command runs in its own thread against its own DB connection, which
must actually see (and block on) the refresh thread's row lock -- neither
works inside TestCase's single wrapping transaction.
"""

import os
import threading
import time
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserProfile
from apps.core.management.commands import ensure_cms_admin


User = get_user_model()

ENV_VARS = ("CMS_ADMIN_USERNAME", "CMS_ADMIN_PASSWORD", "CMS_ADMIN_EMAIL", "CMS_ADMIN_FORCE_RESET")


@override_settings(DEBUG=False)
class EnsureCmsAdminForceResetVsConcurrentRefreshRaceTests(TransactionTestCase):
    def setUp(self):
        patcher = mock.patch.dict(os.environ, {}, clear=False)
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in ENV_VARS:
            os.environ.pop(name, None)

        os.environ["CMS_ADMIN_USERNAME"] = "auth001-force-reset-admin"
        os.environ["CMS_ADMIN_PASSWORD"] = "first-real-strong-password-123"
        call_command("ensure_cms_admin")
        self.admin = User.objects.get(username="auth001-force-reset-admin")

    def _login(self):
        client = APIClient()
        response = client.post(
            "/api/auth/login/",
            {"username": "auth001-force-reset-admin", "password": "first-real-strong-password-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_concurrent_refresh_cannot_outlive_a_force_reset(self):
        pre_reset = self._login()

        snapshot_taken = threading.Event()

        def delayed_revoke(user):
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

        def do_force_reset():
            try:
                os.environ["CMS_ADMIN_USERNAME"] = "auth001-force-reset-admin"
                os.environ["CMS_ADMIN_PASSWORD"] = "second-real-strong-password-456"
                os.environ["CMS_ADMIN_FORCE_RESET"] = "1"
                call_command("ensure_cms_admin")
                results["force_reset_ran"] = True
            finally:
                connection.close()

        def do_refresh():
            try:
                self.assertTrue(snapshot_taken.wait(timeout=5), "snapshot signal never fired")
                client = APIClient()
                response = client.post(
                    "/api/auth/refresh/",
                    {"refresh": pre_reset["refresh"]},
                    format="json",
                )
                results["refresh_status"] = response.status_code
                results["refresh_data"] = response.data
            finally:
                connection.close()

        # AUTH-001-FORCE-RESET-RACE (reopened -- test bug, fix code was
        # already independently confirmed correct): ensure_cms_admin.py
        # does `from apps.accounts.serializers import
        # revoke_all_outstanding_tokens`, a direct name import that binds
        # its own `ensure_cms_admin.revoke_all_outstanding_tokens`
        # reference at import time -- patching the attribute on the
        # apps.accounts.serializers module (as test_auth001_race.py
        # correctly does, since ChangePasswordSerializer.save() calls the
        # function via a bare same-module name looked up at call time)
        # does not touch that already-bound reference. Must patch it where
        # ensure_cms_admin.py looks it up.
        with mock.patch.object(
            ensure_cms_admin,
            "revoke_all_outstanding_tokens",
            side_effect=delayed_revoke,
        ):
            thread_a = threading.Thread(target=do_force_reset)
            thread_b = threading.Thread(target=do_refresh)
            thread_a.start()
            thread_b.start()
            thread_a.join(timeout=15)
            thread_b.join(timeout=15)

        self.assertFalse(thread_a.is_alive(), "force-reset thread never finished (deadlock?)")
        self.assertFalse(thread_b.is_alive(), "refresh thread never finished (deadlock?)")
        self.assertTrue(results.get("force_reset_ran"), results)
        self.assertIn("refresh_status", results, "refresh request never completed")

        if results["refresh_status"] == 200:
            # Pre-fix, this is the branch that is hit: the racing refresh
            # succeeded and minted a descendant refresh token before the
            # force-reset's blacklist insert ran, so it wasn't in that
            # snapshot. Assert that descendant cannot itself still be
            # used -- i.e. it must not have survived the reset.
            descendant_refresh = results["refresh_data"]["refresh"]
            survive_check = APIClient().post(
                "/api/auth/refresh/",
                {"refresh": descendant_refresh},
                format="json",
            )
            self.assertEqual(
                survive_check.status_code,
                401,
                "AUTH-001-FORCE-RESET-RACE: a refresh token minted by a "
                "request racing the CMS admin force-reset survived it.",
            )
        else:
            # Post-fix, this is the branch that is hit: the racing
            # refresh blocks on the same row lock as the force-reset and,
            # once unblocked, re-verifies the (by then blacklisted)
            # pre-reset token from scratch and is correctly rejected.
            self.assertEqual(results["refresh_status"], 401, results)

        # Either way, the original pre-reset refresh token must be dead
        # once both requests have settled.
        final_check = APIClient().post(
            "/api/auth/refresh/",
            {"refresh": pre_reset["refresh"]},
            format="json",
        )
        self.assertEqual(final_check.status_code, 401, final_check.data)

        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("second-real-strong-password-456"))
