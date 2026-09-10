"""Concurrency-safety tests for the "at most one default address per user"
invariant on Address (see backend/apps/shop/models/orders.py and
AddressSerializer in backend/apps/shop/serializers/orders.py).

Real Postgres is required for a genuine proof here -- this repo's test
settings point DATABASE_URL at the besat_db Postgres container (see
config/settings/test.py) -- because the fix relies on real row-level
SELECT ... FOR UPDATE locking plus a partial UNIQUE constraint that only a
real relational engine enforces the way Postgres does.
"""

import threading

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from .models import Address

User = get_user_model()


def _address_payload(is_default=True, **overrides):
    payload = {
        "recipient_full_name": "کاربر تست",
        "phone": "09120000000",
        "province": "تهران",
        "city": "تهران",
        "address_line1": "خیابان آزمایشی",
        "is_default": is_default,
    }
    payload.update(overrides)
    return payload


class DefaultAddressSequentialTests(TestCase):
    """Deterministic (non-threaded) proof of the invariant for the
    ordinary, non-racing path."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="addr_seq", password="x")
        self.client.force_authenticate(self.user)

    def test_setting_a_new_default_clears_the_previous_one(self):
        first = self.client.post("/api/shop/addresses/", _address_payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(
            "/api/shop/addresses/", _address_payload(recipient_full_name="دوم"), format="json"
        )
        self.assertEqual(second.status_code, 201, second.data)

        defaults = Address.objects.filter(user=self.user, is_default=True)
        self.assertEqual(defaults.count(), 1)
        self.assertEqual(defaults.get().pk, second.data["id"])

    def test_db_constraint_rejects_a_second_default_created_below_the_serializer(self):
        """The model-level UniqueConstraint is the correctness backstop --
        prove it actually rejects a duplicate even if some future code path
        creates an Address directly instead of going through
        AddressSerializer."""
        base_fields = {k: v for k, v in _address_payload().items() if k != "is_default"}
        Address.objects.create(user=self.user, is_default=True, **base_fields)

        other_fields = {
            k: v for k, v in _address_payload(recipient_full_name="دوم").items() if k != "is_default"
        }
        with self.assertRaises(IntegrityError):
            Address.objects.create(user=self.user, is_default=True, **other_fields)


class ThreadedDefaultAddressRaceTests(TransactionTestCase):
    """The actual repro from the ticket: two concurrent authenticated POSTs
    creating a new address with is_default=true for the SAME user,
    synchronized to land at the same instant. Before the fix this produced
    two simultaneous is_default=True rows; after the fix the race must
    resolve to exactly one default, with neither request surfacing a raw
    500."""

    def _run_concurrent_default_creates(self):
        user = User.objects.create_user(username="addr_race", password="x")
        results = {}
        barrier = threading.Barrier(2)

        def attempt(name, recipient_name):
            client = APIClient()
            client.force_authenticate(user)
            try:
                barrier.wait(timeout=5)
                response = client.post(
                    "/api/shop/addresses/",
                    _address_payload(recipient_full_name=recipient_name),
                    format="json",
                )
                results[name] = response.status_code
            finally:
                connection.close()

        thread_a = threading.Thread(target=attempt, args=("a", "متقاضی الف"))
        thread_b = threading.Thread(target=attempt, args=("b", "متقاضی ب"))
        thread_a.start()
        thread_b.start()
        thread_a.join(timeout=10)
        thread_b.join(timeout=10)
        return user, results

    def test_two_concurrent_default_creates_never_leave_two_defaults(self):
        user, results = self._run_concurrent_default_creates()

        # Neither request may surface a raw unhandled 500 -- the app-level
        # retry (see AddressSerializer.create) must absorb the
        # IntegrityError from the DB backstop constraint.
        self.assertNotIn(500, results.values(), results)

        # The invariant this whole fix exists for: never two simultaneous
        # defaults, no matter how the race resolves.
        default_count = Address.objects.filter(user=user, is_default=True).count()
        self.assertEqual(default_count, 1, "expected exactly one default address after the race")

        # Both concurrent requests are handled cleanly: the loser of the
        # race re-serializes behind a retry and still gets a clean 201
        # (becoming the new default), rather than an error.
        self.assertEqual(list(results.values()), [201, 201], results)
        self.assertEqual(Address.objects.filter(user=user).count(), 2)


class ThreeWayDefaultAddressRaceTests(TransactionTestCase):
    """Round-2 regression: with a hard-coded 2-attempt retry budget, 3
    simultaneous "first default address" creates for the same user
    deterministically exhausted one racer's retry budget and surfaced a
    raw, unhandled 500 (reproduced 20/20 runs). The DB-level partial
    unique constraint always prevented data corruption -- the gap was
    purely the retry loop being too tight for 3-way (or wider) races.

    AddressSerializer._MAX_DEFAULT_ADDRESS_ATTEMPTS is now 5, which must
    be enough headroom for 3 simultaneous racers to always converge
    cleanly: every request gets a clean 2xx/4xx response, never a 500,
    and exactly one address ends up as the default.
    """

    def _run_three_concurrent_default_creates(self):
        user = User.objects.create_user(username="addr_race3", password="x")
        results = {}
        barrier = threading.Barrier(3)

        def attempt(name, recipient_name):
            client = APIClient()
            client.force_authenticate(user)
            try:
                barrier.wait(timeout=5)
                response = client.post(
                    "/api/shop/addresses/",
                    _address_payload(recipient_full_name=recipient_name),
                    format="json",
                )
                results[name] = response.status_code
            finally:
                connection.close()

        threads = [
            threading.Thread(target=attempt, args=("a", "متقاضی الف")),
            threading.Thread(target=attempt, args=("b", "متقاضی ب")),
            threading.Thread(target=attempt, args=("c", "متقاضی ج")),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)
        return user, results

    def test_three_concurrent_default_creates_never_5xx_and_exactly_one_default(self):
        user, results = self._run_three_concurrent_default_creates()

        self.assertEqual(len(results), 3, results)

        # The regression this test targets: no request may surface a raw
        # unhandled 500, no matter how the 3-way race resolves.
        server_errors = {name: code for name, code in results.items() if code >= 500}
        self.assertFalse(server_errors, f"unexpected server error(s): {server_errors}, all: {results}")

        # Every request still gets a clean, well-formed response.
        for name, code in results.items():
            self.assertIn(code, (200, 201), f"request {name!r} got unexpected status {code}: {results}")

        # The invariant this whole fix exists for: never more than one
        # simultaneous default, no matter how the 3-way race resolves.
        default_count = Address.objects.filter(user=user, is_default=True).count()
        self.assertEqual(default_count, 1, "expected exactly one default address after the 3-way race")

        # All three addresses were actually created (none silently lost).
        self.assertEqual(Address.objects.filter(user=user).count(), 3)
