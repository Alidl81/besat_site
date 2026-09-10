"""AUTH-002 regression: two concurrent /api/auth/refresh/ requests carrying
the SAME refresh token must not both succeed.

SIMPLE_JWT's rotate-and-blacklist-on-refresh (ROTATE_REFRESH_TOKENS +
BLACKLIST_AFTER_ROTATION) is meant to make a refresh token single-use: the
first refresh blacklists the old token and mints a rotated descendant, and
any later attempt to reuse the old token is rejected because it's now in the
blacklist. Naively, though, two truly concurrent requests carrying the same
refresh token can both read "not blacklisted yet" before either one's
blacklist insert commits, letting both mint a valid rotated descendant --
destroying the single-use/replay-detection property exactly when it matters
most (a legitimate user racing an attacker holding a stolen token).

AUTH-001's fix (RefreshTokenSerializer.validate() in
apps/accounts/serializers.py) added a `select_for_update()` lock on the
token's own UserProfile row, taken *before* delegating to SIMPLE_JWT's real
`super().validate(attrs)` (which does the verified decode + blacklist check
+ rotation), for an unrelated bug (a refresh racing a password change). That
same per-user row lock structurally also serializes two concurrent refreshes
of the *same* token for the *same* user: whichever request acquires the
UserProfile row lock first runs its full blacklist-check-then-rotate inside
the lock and commits (releasing the lock) before the second request's lock
acquisition can proceed; the second request then re-decodes the (by then
already-blacklisted) token from scratch under the lock and is correctly
rejected. This test proves that holds under genuine thread-level
concurrency -- not just sequential calls that happen not to race -- rather
than assuming it from reading the code.

Requires TransactionTestCase (not TestCase): the two request threads use
independent DB connections that must actually block on each other's
row lock and see each other's committed state, neither of which works
inside TestCase's single wrapping transaction.
"""

import threading

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile


User = get_user_model()


class ConcurrentRefreshTokenReplayRaceTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="auth002-race",
            password="password123",
            email="auth002-race@example.com",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.profile.is_active = True
        self.profile.save()

    def _login(self):
        client = APIClient()
        response = client.post(
            "/api/auth/login/",
            {"username": "auth002-race", "password": "password123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_concurrent_refresh_with_same_token_is_single_use(self):
        tokens = self._login()
        refresh_token = tokens["refresh"]

        # A two-party barrier lines both request threads up right before
        # they fire their POST, to maximize genuine overlap at the actual
        # DB-lock-acquisition race window instead of relying on incidental
        # scheduling luck.
        barrier = threading.Barrier(2, timeout=10)
        results = {}
        results_lock = threading.Lock()

        def do_refresh(name):
            try:
                barrier.wait()
                client = APIClient()
                response = client.post(
                    "/api/auth/refresh/",
                    {"refresh": refresh_token},
                    format="json",
                )
                with results_lock:
                    results[name] = (response.status_code, response.data)
            finally:
                connection.close()

        thread_a = threading.Thread(target=do_refresh, args=("a",))
        thread_b = threading.Thread(target=do_refresh, args=("b",))
        thread_a.start()
        thread_b.start()
        thread_a.join(timeout=15)
        thread_b.join(timeout=15)

        self.assertFalse(thread_a.is_alive(), "refresh thread a never finished (deadlock?)")
        self.assertFalse(thread_b.is_alive(), "refresh thread b never finished (deadlock?)")
        self.assertIn("a", results, "refresh request a never completed")
        self.assertIn("b", results, "refresh request b never completed")

        statuses = [results["a"][0], results["b"][0]]
        success_count = statuses.count(200)

        self.assertLessEqual(
            success_count,
            1,
            "AUTH-002: two concurrent refresh requests carrying the same "
            f"refresh token both succeeded (statuses={statuses}, "
            f"results={results}) -- the refresh token was not single-use "
            "under real concurrency.",
        )
        self.assertGreaterEqual(
            success_count,
            1,
            "neither concurrent refresh succeeded -- expected exactly one "
            f"winner (statuses={statuses}, results={results}); the lock "
            "may be over-serializing or deadlocking rather than just "
            "rejecting the loser cleanly.",
        )

        loser_status = statuses[0] if statuses[1] == 200 else statuses[1]
        self.assertEqual(
            loser_status,
            401,
            f"expected the losing concurrent refresh to be cleanly "
            f"rejected with 401, got {loser_status} (results={results})",
        )

        # Sanity: the winner's rotated descendant is itself a normal,
        # usable refresh token -- confirms the lock didn't just make
        # rotation stop working altogether.
        winner = results["a"] if results["a"][0] == 200 else results["b"]
        descendant_refresh = winner[1]["refresh"]
        replay = APIClient().post(
            "/api/auth/refresh/",
            {"refresh": descendant_refresh},
            format="json",
        )
        self.assertEqual(replay.status_code, 200, replay.data)

        # And the original, now-doubly-used-attempt token must be dead for
        # good -- no third party can come along afterwards and succeed
        # with it either.
        final_check = APIClient().post(
            "/api/auth/refresh/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(final_check.status_code, 401, final_check.data)
