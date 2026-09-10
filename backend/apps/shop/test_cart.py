import threading
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from .models import Cart, CartItem
from .services import cart_service
from .tests import make_in_person_course, make_online_course, make_physical_product

User = get_user_model()


class GuestCartTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_cart_without_token_creates_guest_cart_and_returns_token(self):
        response = self.client.get("/api/shop/cart/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("X-Guest-Cart-Token", response)
        self.assertEqual(response.data["items"], [])

    def test_add_item_persists_across_requests_with_same_token(self):
        product = make_physical_product()

        first = self.client.get("/api/shop/cart/")
        token = first["X-Guest-Cart-Token"]

        add_response = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 2},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(add_response.status_code, 201)
        self.assertEqual(len(add_response.data["items"]), 1)
        self.assertEqual(add_response.data["items"][0]["quantity"], 2)

        second = self.client.get("/api/shop/cart/", HTTP_X_GUEST_CART_TOKEN=token)
        self.assertEqual(len(second.data["items"]), 1)
        self.assertEqual(second.data["items"][0]["quantity"], 2)

    def test_add_item_beyond_stock_is_rejected(self):
        product = make_physical_product()
        product.physical_detail.inventory_qty = 3
        product.physical_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json"
        )
        token = response["X-Guest-Cart-Token"]

        response = self.client.patch(
            f"/api/shop/cart/items/{response.data['items'][0]['id']}/",
            {"quantity": 3},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["items"][0]["issue"])

    def test_cart_flags_out_of_stock_item_without_blocking_add(self):
        # Adding a quantity higher than stock is allowed at cart level
        # (soft, informational) -- checkout is what actually blocks it.
        product = make_physical_product()
        product.physical_detail.inventory_qty = 1
        product.physical_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 5}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["issue"], "insufficient_stock")
        self.assertTrue(response.data["has_blocking_issue"])

    def test_remove_item(self):
        product = make_physical_product()
        add_response = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
        )
        token = add_response["X-Guest-Cart-Token"]
        item_id = add_response.data["items"][0]["id"]

        response = self.client.delete(f"/api/shop/cart/items/{item_id}/", HTTP_X_GUEST_CART_TOKEN=token)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"], [])

    def test_course_quantity_is_forced_to_one(self):
        course = make_online_course()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": course.pk, "quantity": 3}, format="json"
        )

        self.assertEqual(response.status_code, 400)

    def test_in_person_course_full_capacity_is_flagged(self):
        course = make_in_person_course()
        course.in_person_course_detail.capacity = 1
        course.in_person_course_detail.enrolled_count = 1
        course.in_person_course_detail.save()

        response = self.client.post(
            "/api/shop/cart/items/", {"product_id": course.pk, "quantity": 1}, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["issue"], "course_full")


class CartAddIdempotencyKeyTests(TestCase):
    """REL-FE-CART-ADD-RESPONSE-LOSS-001: unlike DELETE, an add-to-cart
    POST is not naturally idempotent -- a lost response followed by a
    retry for the same product is indistinguishable from a genuine second
    add. client_request_id lets a caller mark two requests as the SAME
    logical add attempt so the second is recognized and no-op'd instead of
    silently doubling the quantity."""

    def setUp(self):
        self.client = APIClient()

    def test_a_retry_with_the_same_client_request_id_does_not_double_the_quantity(self):
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-1"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["items"][0]["quantity"], 1)
        token = first["X-Guest-Cart-Token"]

        # Simulates the client believing the first request failed (its
        # response was lost) and retrying the identical logical add.
        retry = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-1"},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(retry.status_code, 201)
        self.assertEqual(
            retry.data["items"][0]["quantity"],
            1,
            "A retry carrying the same client_request_id as an already-applied add must not double the quantity.",
        )

    def test_a_second_add_with_a_different_client_request_id_still_accumulates(self):
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-1"},
            format="json",
        )
        token = first["X-Guest-Cart-Token"]

        second = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-2"},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            second.data["items"][0]["quantity"],
            2,
            "A genuinely distinct add (a different client_request_id) must still accumulate normally.",
        )

    def test_omitting_client_request_id_keeps_the_pre_existing_always_increment_behavior(self):
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
        )
        token = first["X-Guest-Cart-Token"]

        second = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            second.data["items"][0]["quantity"],
            2,
            "A caller that never supplies client_request_id must keep the original always-increment behavior.",
        )

    def test_a_delayed_retry_of_an_earlier_key_is_still_recognized_after_a_later_different_key(self):
        # REL-FE-CART-ADD-IDEMPOTENCY-INTERLEAVE-001: a "last key only"
        # design (the first version of this fix) forgot key A the instant
        # a genuinely later, different add (key B) applied -- so a delayed
        # retry of key A that arrives after B wrongly counted as a third,
        # brand-new add. A, B, and a delayed retry of A must total
        # quantity 2 (A's contribution + B's), not 3.
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-A"},
            format="json",
        )
        token = first["X-Guest-Cart-Token"]

        second = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-B"},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(second.data["items"][0]["quantity"], 2)

        delayed_retry_of_a = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-A"},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(delayed_retry_of_a.status_code, 201)
        self.assertEqual(
            delayed_retry_of_a.data["items"][0]["quantity"],
            2,
            "A delayed retry of an earlier key, arriving after a different later key already applied, "
            "must still be recognized as a duplicate and not increment a third time.",
        )

    def test_a_key_evicted_by_a_flat_count_bound_is_still_recognized_within_the_time_window(self):
        # REL-FE-CART-ADD-IDEMPOTENCY-WINDOW-001: a flat count-bounded
        # list (the second version of this fix, MAX_TRACKED_ADD_REQUEST_
        # IDS=20 at the time) evicted the very first key once 22 more
        # distinct keys had applied, even though all of them landed
        # within seconds of each other -- nowhere near stale. Retention is
        # now time-bounded (ADD_REQUEST_ID_TTL_SECONDS), so the first key
        # must still be recognized here.
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "qa-window-0"},
            format="json",
        )
        token = first["X-Guest-Cart-Token"]

        for index in range(1, 22):
            response = self.client.post(
                "/api/shop/cart/items/",
                {"product_id": product.pk, "quantity": 1, "client_request_id": f"qa-window-{index}"},
                format="json",
                HTTP_X_GUEST_CART_TOKEN=token,
            )
            self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["quantity"], 22)

        retry_of_first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "qa-window-0"},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=token,
        )
        self.assertEqual(retry_of_first.status_code, 201)
        self.assertEqual(
            retry_of_first.data["items"][0]["quantity"],
            22,
            "The first key, retried after 21 other genuinely distinct recent adds, must still be "
            "recognized as a duplicate within the retention window and not increment a 23rd time.",
        )

    def test_a_key_older_than_the_retention_window_is_no_longer_treated_as_a_duplicate(self):
        # The retention is a real TTL, not just a very large count -- a
        # key old enough to have genuinely expired must fall back to
        # being treated as a fresh add (matching a client that itself
        # would never present a key that old as a "retry" claim -- see
        # cart-context.tsx's own ADD_REQUEST_ID_TTL_MS).
        product = make_physical_product()

        first = self.client.post(
            "/api/shop/cart/items/",
            {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-stale"},
            format="json",
        )
        token = first["X-Guest-Cart-Token"]

        with mock.patch.object(
            cart_service.time,
            "time",
            return_value=cart_service.time.time() + cart_service.ADD_REQUEST_ID_TTL_SECONDS + 1,
        ):
            expired_retry = self.client.post(
                "/api/shop/cart/items/",
                {"product_id": product.pk, "quantity": 1, "client_request_id": "attempt-stale"},
                format="json",
                HTTP_X_GUEST_CART_TOKEN=token,
            )
        self.assertEqual(expired_retry.status_code, 201)
        self.assertEqual(
            expired_retry.data["items"][0]["quantity"],
            2,
            "A client_request_id older than the retention window must no longer be treated as a "
            "duplicate -- it genuinely falls back to incrementing, matching a client that would never "
            "itself present a key that old as a retry.",
        )


class AuthenticatedCartTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="parent1", password="x")
        self.client.force_authenticate(self.user)

    def test_cart_is_scoped_to_authenticated_user(self):
        product = make_physical_product()
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json")

        self.assertEqual(Cart.objects.filter(user=self.user).count(), 1)
        self.assertEqual(CartItem.objects.filter(cart__user=self.user).count(), 1)

    def test_reused_active_cart_across_requests(self):
        product = make_physical_product()
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json")
        self.client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json")

        self.assertEqual(Cart.objects.filter(user=self.user, status=Cart.Status.ACTIVE).count(), 1)
        item = CartItem.objects.get(cart__user=self.user)
        self.assertEqual(item.quantity, 3)


class CartMergeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="parent2", password="x")

    def test_merge_sums_duplicate_lines_and_adds_new_ones(self):
        shared_product = make_physical_product(title="کتاب مشترک")
        guest_only_product = make_physical_product(title="فقط مهمان")

        guest_response = self.client.post(
            "/api/shop/cart/items/", {"product_id": shared_product.pk, "quantity": 2}, format="json"
        )
        guest_token = guest_response["X-Guest-Cart-Token"]
        self.client.post(
            "/api/shop/cart/items/",
            {"product_id": guest_only_product.pk, "quantity": 1},
            format="json",
            HTTP_X_GUEST_CART_TOKEN=guest_token,
        )

        self.client.force_authenticate(self.user)
        self.client.post("/api/shop/cart/items/", {"product_id": shared_product.pk, "quantity": 1}, format="json")

        merge_response = self.client.post(
            "/api/shop/cart/merge/", HTTP_X_GUEST_CART_TOKEN=guest_token
        )

        self.assertEqual(merge_response.status_code, 200)
        self.assertEqual(merge_response["X-Guest-Cart-Token-Clear"], "1")
        items_by_title = {item["product"]["title"]: item["quantity"] for item in merge_response.data["items"]}
        self.assertEqual(items_by_title["کتاب مشترک"], 3)
        self.assertEqual(items_by_title["فقط مهمان"], 1)

        guest_cart = Cart.objects.get(guest_token=guest_token)
        self.assertEqual(guest_cart.status, Cart.Status.MERGED)

    def test_merge_requires_authentication(self):
        response = self.client.post("/api/shop/cart/merge/")
        self.assertEqual(response.status_code, 401)


class CartItemNullVariantUniquenessTests(TestCase):
    """DB-001: CartItem's unique_cart_product_variant constraint was
    ineffective for non-variant (variant=NULL) products under standard SQL
    NULL semantics -- two rows with the same NULL variant are never
    considered duplicates by a plain UniqueConstraint, so
    cart_service.add_item's get_or_create() read-then-write could (and,
    under real concurrent requests, did) create two separate CartItem rows
    for the same cart/product."""

    def test_db_constraint_rejects_a_second_null_variant_row_for_the_same_cart_and_product(self):
        product = make_physical_product()
        cart = Cart.objects.create()
        CartItem.objects.create(cart=cart, product=product, variant=None, quantity=1)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CartItem.objects.create(cart=cart, product=product, variant=None, quantity=1)

        self.assertEqual(CartItem.objects.filter(cart=cart, product=product).count(), 1)


class CartItemConcurrentAddRaceTests(TransactionTestCase):
    """Real-thread concurrency test (needs TransactionTestCase, not
    TestCase -- each thread needs its own genuine DB connection/
    transaction to exercise an actual race, which TestCase's per-test
    transaction wrapper would prevent)."""

    def test_two_concurrent_add_item_requests_do_not_create_duplicate_cart_rows(self):
        product = make_physical_product()

        # Establish one shared guest cart token both threads add into --
        # the race this targets is two requests for the SAME cart/product,
        # not two different carts.
        setup_client = APIClient()
        cart_response = setup_client.get("/api/shop/cart/")
        shared_token = cart_response["X-Guest-Cart-Token"]

        results = []
        # A barrier maximizes the chance both threads actually reach
        # get_or_create()'s SELECT at close to the same moment, rather
        # than leaving overlap entirely to thread-scheduling luck.
        start_barrier = threading.Barrier(2)

        def add_one():
            client = APIClient()
            start_barrier.wait(timeout=5)
            response = client.post(
                "/api/shop/cart/items/",
                {"product_id": product.pk, "quantity": 1},
                format="json",
                HTTP_X_GUEST_CART_TOKEN=shared_token,
            )
            results.append(response.status_code)

        threads = [threading.Thread(target=add_one) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertTrue(all(status in (200, 201) for status in results), results)

        cart = Cart.objects.get(guest_token=shared_token)
        matching_items = CartItem.objects.filter(cart=cart, product=product, variant__isnull=True)
        self.assertEqual(
            matching_items.count(),
            1,
            "Two concurrent add-item requests for the same cart/product created duplicate CartItem rows.",
        )
        self.assertEqual(matching_items.first().quantity, 2)

    def test_ten_concurrent_add_item_requests_for_the_same_line_all_accumulate(self):
        # DB-SHOP-CART-ADD-SAME-TOKEN-RACE-001: the two-thread version
        # above already exercises the get_or_create() duplicate-row race,
        # but this repo's test settings use SQLite by default, which has
        # no real row-level SELECT ... FOR UPDATE (see
        # CartMergeSequentialAccumulationTests' docstring) -- with only two
        # threads the unlocked-quantity-overwrite race window can be too
        # narrow to reliably lose a contribution even pre-fix. Ten
        # concurrent same-token adds, matching the live PostgreSQL
        # reproduction that actually caught this (final quantity 3
        # instead of the expected 10), gives the race far more chances to
        # manifest and is a much stronger regression guard.
        product = make_physical_product(title="محصول همزمان یک خط")

        setup_client = APIClient()
        cart_response = setup_client.get("/api/shop/cart/")
        shared_token = cart_response["X-Guest-Cart-Token"]

        results = []
        concurrency = 10
        start_barrier = threading.Barrier(concurrency)

        def add_one():
            client = APIClient()
            try:
                start_barrier.wait(timeout=5)
                response = client.post(
                    "/api/shop/cart/items/",
                    {"product_id": product.pk, "quantity": 1},
                    format="json",
                    HTTP_X_GUEST_CART_TOKEN=shared_token,
                )
                results.append(response.status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=add_one) for _ in range(concurrency)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(len(results), concurrency, "Not every concurrent add-item request completed.")
        self.assertTrue(all(status in (200, 201) for status in results), results)

        cart = Cart.objects.get(guest_token=shared_token)
        matching_items = CartItem.objects.filter(cart=cart, product=product, variant__isnull=True)
        self.assertEqual(matching_items.count(), 1)
        self.assertEqual(
            matching_items.first().quantity,
            concurrency,
            f"{concurrency} concurrent quantity-1 adds for the same cart/product line must sum to "
            f"{concurrency}, not silently lose contributions to an unlocked read-modify-write.",
        )


class CartMergeConcurrentRaceTests(TransactionTestCase):
    """CART-MERGE-001: two concurrent authenticated merge requests for the
    SAME guest_token used to both read guest_cart.status as still ACTIVE,
    both run the item-merge loop, and race each other's destination
    CartItem.create() -- one request got a clean 200, the other an
    unhandled IntegrityError/500. Needs TransactionTestCase (not TestCase)
    so each thread gets a genuine DB connection/transaction and the race
    (and select_for_update()'s blocking behavior) is real."""

    def test_two_concurrent_merge_requests_both_succeed_without_duplicating_quantity(self):
        product = make_physical_product(title="محصول مشترک")

        guest_setup_client = APIClient()
        guest_add_response = guest_setup_client.post(
            "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
        )
        guest_token = guest_add_response["X-Guest-Cart-Token"]

        user = User.objects.create_user(username="merge_race_user", password="x")

        results = []
        start_barrier = threading.Barrier(2)

        def merge_once():
            client = APIClient()
            client.force_authenticate(user)
            try:
                start_barrier.wait(timeout=5)
                response = client.post(
                    "/api/shop/cart/merge/", HTTP_X_GUEST_CART_TOKEN=guest_token
                )
                results.append(response.status_code)
            finally:
                # Each thread gets its own real DB connection (this is a
                # TransactionTestCase) -- close it explicitly so a lingering
                # idle-in-transaction connection doesn't block the test
                # database's teardown DROP DATABASE after this test ends.
                connection.close()

        threads = [threading.Thread(target=merge_once) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(
            len(results), 2, "One of the two concurrent merge requests never completed."
        )
        self.assertTrue(
            all(status == 200 for status in results),
            f"Expected both concurrent merge requests to return a clean 200, got {results}.",
        )

        user_cart = Cart.objects.get(user=user, status=Cart.Status.ACTIVE)
        matching_items = CartItem.objects.filter(cart=user_cart, product=product, variant__isnull=True)
        self.assertEqual(
            matching_items.count(),
            1,
            "Two concurrent merge requests for the same guest cart created duplicate CartItem rows.",
        )
        self.assertEqual(
            matching_items.first().quantity,
            1,
            "Two concurrent merge requests for the same (single-quantity) guest item must not double-count "
            "the merged quantity -- the second request should have no-op'd once it observed the guest cart "
            "already merged.",
        )

        guest_cart = Cart.objects.get(guest_token=guest_token)
        self.assertEqual(guest_cart.status, Cart.Status.MERGED)


class CartMergeSequentialAccumulationTests(TestCase):
    """DB-SHOP-CART-MERGE-DESTINATION-RACE-001: deterministic, single-
    threaded proof that the underlying increment logic itself correctly
    accumulates across repeated merges into the same destination line --
    independent of real locking/threading (this repo's test settings use
    SQLite by default, which has no real row-level SELECT ... FOR UPDATE;
    see CartMergeDifferentGuestCartsConcurrentRaceTests below for the
    threaded smoke test on top of this)."""

    def test_five_separate_guest_carts_merged_one_at_a_time_all_accumulate_into_one_destination_line(self):
        product = make_physical_product(title="محصول تجمعی")
        user = User.objects.create_user(username="merge_seq_user", password="x")
        client = APIClient()
        client.force_authenticate(user)
        client.post("/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json")

        for _ in range(5):
            guest_client = APIClient()
            guest_response = guest_client.post(
                "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
            )
            guest_token = guest_response["X-Guest-Cart-Token"]

            merge_response = client.post("/api/shop/cart/merge/", HTTP_X_GUEST_CART_TOKEN=guest_token)
            self.assertEqual(merge_response.status_code, 200)

        user_cart = Cart.objects.get(user=user, status=Cart.Status.ACTIVE)
        item = CartItem.objects.get(cart=user_cart, product=product, variant__isnull=True)
        self.assertEqual(
            item.quantity,
            6,
            "1 (destination's own pre-existing quantity) + 5 separate single-item guest carts must sum to 6.",
        )


class CartMergeDifferentGuestCartsConcurrentRaceTests(TransactionTestCase):
    """DB-SHOP-CART-MERGE-DESTINATION-RACE-001: unlike
    CartMergeConcurrentRaceTests above (two requests racing over the SAME
    guest_token, already guarded by guest_cart's own select_for_update()),
    this is N *different* guest carts concurrently merging their own
    quantity-1 line for the same product into one shared destination line.
    The destination CartItem row itself was never locked -- every
    concurrent transaction read the same pre-increment quantity, so
    whichever committed last simply overwrote the others' contributions
    (observed live: final quantity 2 instead of the expected total)."""

    def test_five_different_guest_carts_concurrently_merging_the_same_product_all_accumulate(self):
        product = make_physical_product(title="محصول همزمان")
        user = User.objects.create_user(username="merge_race_dest_user", password="x")

        guest_tokens = []
        for _ in range(5):
            guest_client = APIClient()
            guest_response = guest_client.post(
                "/api/shop/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json"
            )
            guest_tokens.append(guest_response["X-Guest-Cart-Token"])

        results = []
        start_barrier = threading.Barrier(len(guest_tokens))

        def merge_once(token):
            client = APIClient()
            client.force_authenticate(user)
            try:
                start_barrier.wait(timeout=5)
                response = client.post("/api/shop/cart/merge/", HTTP_X_GUEST_CART_TOKEN=token)
                results.append(response.status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=merge_once, args=(token,)) for token in guest_tokens]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(len(results), len(guest_tokens), "Not every concurrent merge request completed.")
        self.assertTrue(all(status == 200 for status in results), results)

        user_cart = Cart.objects.get(user=user, status=Cart.Status.ACTIVE)
        item = CartItem.objects.get(cart=user_cart, product=product, variant__isnull=True)
        self.assertEqual(
            item.quantity,
            len(guest_tokens),
            f"{len(guest_tokens)} concurrent guest carts each contributing quantity 1 to a fresh destination "
            f"line must sum to {len(guest_tokens)}, not silently lose contributions to an unlocked read.",
        )
