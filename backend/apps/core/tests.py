from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache as django_cache
from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.throttling import BaseThrottle

from apps.core import views as core_views


def _raise_db_error(*args, **kwargs):
    # A representative real exception message -- includes a hostname,
    # database name, and username, exactly like a real connection failure
    # would, so the leak-detection assertions below are testing against
    # realistic content rather than a sanitized stand-in.
    raise DatabaseError(
        "connection to server at \"does-not-exist.invalid\" (10.0.0.5), "
        "port 5432 failed: could not translate host name for database "
        "\"besat_prod\" user \"besat_admin\": Name or service not known"
    )


class CoreAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # The debounce cache in apps.core.views is process-global, not
        # per-test -- without clearing it here, a cached "ok"/"down"
        # result from one test could leak into the next one if both run
        # within the debounce window (they do; the whole suite runs in
        # well under 2 seconds).
        core_views._db_check_cache.clear()
        django_cache.clear()

    def test_health_check_returns_ok(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok.")

    def test_liveness_never_checks_dependencies(self):
        """Liveness must stay 200 regardless of dependency state -- it
        exists specifically so an orchestrator never restart-loops the
        process over a database blip. Verified here by asserting the
        response contains no dependency check data at all, not just that
        it happens to return 200 today.
        """
        response = self.client.get("/api/health/live/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok.")
        self.assertEqual(response.data["service"], "besat-backend")
        self.assertNotIn("checks", response.data)

    def test_readiness_reports_healthy_database_with_a_minimal_payload(self):
        """Readiness is public/unauthenticated by design (load balancers
        need to reach it without custom auth), so it must never carry a
        dependency breakdown -- only a status word. Asserted here by name:
        the response must contain exactly {"status": ...} and nothing else
        that could describe internal topology.
        """
        response = self.client.get("/api/health/ready/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok.")
        self.assertEqual(set(response.data.keys()), {"status"})

    def test_readiness_reports_unreachable_database_as_503_without_leaking_details(self):
        """The exact false-positive this endpoint was fixed to close: a
        database the app cannot reach must flip readiness to 503, not stay
        silently green. The DB failure is simulated by mocking the cursor
        call to raise a DatabaseError with realistic content (hostname, DB
        name, username -- see _raise_db_error) rather than actually
        breaking the real test database's connection, which would corrupt
        Django's own TestCase transaction machinery for later tests in
        this class. Also proves the information-disclosure fix: the
        response must never contain any of that exception text.
        """
        with patch("apps.core.views.connections") as mock_connections:
            mock_connections.__getitem__.return_value.cursor.side_effect = _raise_db_error
            response = self.client.get("/api/health/ready/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data, {"status": "not_ready."})

        body_text = str(response.data)
        for leaked in ("does-not-exist", "besat_admin", "besat_prod", "5432", "10.0.0.5", "could not", "refused"):
            self.assertNotIn(
                leaked.lower(),
                body_text.lower(),
                f"Readiness response leaked internal detail: {leaked!r}",
            )

    def test_deep_health_check_requires_the_internal_token(self):
        """The brief's explicit requirement: deep health must not be an
        unrestricted public diagnostic API, regardless of how harmless its
        fields look. Default (unconfigured) INTERNAL_HEALTH_TOKEN must fail
        closed -- unreachable by anyone, not accidentally open.
        """
        response = self.client.get("/api/health/deep/")

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("checks", response.data)

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-token-value")
    def test_deep_health_check_rejects_wrong_token(self):
        response = self.client.get(
            "/api/health/deep/",
            HTTP_X_INTERNAL_HEALTH_TOKEN="wrong-token",
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-token-value")
    def test_deep_health_check_returns_per_dependency_status_and_latency_with_correct_token(self):
        response = self.client.get(
            "/api/health/deep/",
            HTTP_X_INTERNAL_HEALTH_TOKEN="test-internal-token-value",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["checks"]["database"]["status"], "ok")
        self.assertIn("latency_ms", response.data["checks"]["database"])

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-token-value")
    def test_deep_health_check_never_leaks_raw_exception_even_when_authorized(self):
        """Authorization is not a license to leak: the brief's "never
        expose" list (hostname, DB name, username, credentials, raw
        exceptions, internal IPs, stack traces) applies even to the
        authenticated deep endpoint.
        """
        with patch("apps.core.views.connections") as mock_connections:
            mock_connections.__getitem__.return_value.cursor.side_effect = _raise_db_error
            response = self.client.get(
                "/api/health/deep/",
                HTTP_X_INTERNAL_HEALTH_TOKEN="test-internal-token-value",
            )

        database_check = response.data["checks"]["database"]
        self.assertEqual(database_check["status"], "down")
        self.assertEqual(set(database_check.keys()), {"status", "latency_ms"})
        body_text = str(response.data)
        for leaked in ("does-not-exist", "besat_admin", "besat_prod", "5432", "10.0.0.5", "could not", "refused"):
            self.assertNotIn(leaked.lower(), body_text.lower())

    def test_request_gets_a_correlation_id_in_the_response(self):
        response = self.client.get("/api/health/live/")

        self.assertIn("X-Request-ID", response)
        self.assertTrue(len(response["X-Request-ID"]) > 0)

    def test_inbound_request_id_is_echoed_back_not_replaced(self):
        """A single browser request should be traceable end-to-end by one
        ID -- the frontend BFF proxy sets X-Request-ID before forwarding
        to Django; Django must propagate that same value, not mint a new
        one, or the correlation chain breaks at this hop.
        """
        response = self.client.get(
            "/api/health/live/",
            HTTP_X_REQUEST_ID="test-fixed-request-id-12345",
        )

        self.assertEqual(response["X-Request-ID"], "test-fixed-request-id-12345")

    def test_metrics_endpoint_requires_the_internal_token(self):
        """Same information-disclosure/access-control posture as deep
        health, and for the same reason: django_prometheus's export view
        has zero authentication of its own by design -- confirmed from
        its own upstream documentation, which explicitly states it
        performs no auth checks -- so this app's own wrapper is the only
        thing standing between it and the public internet.
        """
        response = self.client.get("/api/metrics/")

        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-token-value")
    def test_metrics_endpoint_rejects_wrong_token(self):
        response = self.client.get(
            "/api/metrics/",
            HTTP_X_INTERNAL_HEALTH_TOKEN="wrong-token",
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-token-value")
    def test_metrics_endpoint_returns_prometheus_text_format_with_correct_token(self):
        response = self.client.get(
            "/api/metrics/",
            HTTP_X_INTERNAL_HEALTH_TOKEN="test-internal-token-value",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/plain", response["Content-Type"])
        body = response.content.decode()
        # A real Prometheus counter django-prometheus registers for every
        # request it's ever seen -- proves this is genuinely wired to the
        # request-metrics middleware, not just returning an empty registry.
        self.assertIn("django_http_requests_before_middlewares_total", body)

    def test_chema_endpoint_is_available(self):
        response = self.client.get("/api/schema/")

        self.assertEqual(response.status_code, 200)

    def test_swagger_docs_endpoint_is_available(self):
        response = self.client.get("/api/docs/")

        self.assertEqual(response.status_code, 200)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
            "DEFAULT_THROTTLE_RATES": {"anon": "1/day"},
        }
    )
    def test_health_endpoints_are_never_rate_limited(self):
        """The real incident this regression-tests: with DRF's default
        AnonRateThrottle applied (as it is everywhere else in this API by
        DEFAULT_THROTTLE_CLASSES), the docker-compose healthcheck polling
        /api/health/ every 10 seconds was on its own enough anonymous
        traffic to exceed the 100/hour anon limit and flap the live
        container to "unhealthy" -- observed directly in this session's
        `docker compose logs backend` output as repeated 429s on
        /api/health/. An orchestrator that kills/restarts on failed
        healthchecks would have turned that into a real, self-inflicted
        outage. Proven here with a deliberately extreme "1/day" anon rate
        (rather than looping to 100+ requests) -- if these views were not
        explicitly exempted via @throttle_classes([]), even the second
        request in this test would already be a 429.
        """
        for path in ("/api/health/", "/api/health/live/", "/api/health/ready/"):
            for attempt in range(3):
                response = self.client.get(path)
                self.assertNotEqual(
                    response.status_code,
                    429,
                    f"{path} was rate limited on attempt {attempt + 1} -- "
                    "health/readiness endpoints must never be throttled.",
                )

    @override_settings(INTERNAL_HEALTH_TOKEN="test-internal-health-token")
    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
            "DEFAULT_THROTTLE_RATES": {"anon": "1/day"},
        }
    )
    def test_deep_health_check_is_never_rate_limited(self):
        for attempt in range(3):
            response = self.client.get(
                "/api/health/deep/",
                HTTP_X_INTERNAL_HEALTH_TOKEN="test-internal-health-token",
            )
            self.assertNotEqual(
                response.status_code,
                429,
                f"deep health was rate limited on attempt {attempt + 1}.",
            )

    def test_readiness_debounces_the_real_database_probe(self):
        """_check_database's debounce window exists specifically so that
        readiness/deep-health being un-throttled (see the two tests above)
        does not turn into unbounded `SELECT 1` pressure on Postgres when
        polled very frequently by multiple systems at once (load balancer
        + orchestrator + external monitor). Proven here by counting real
        cursor acquisitions across three back-to-back requests, which --
        run synchronously in a test -- land well inside the debounce
        window: only the first should touch the database.
        """
        with patch("apps.core.views.connections") as mock_connections:
            cursor_cm = mock_connections.__getitem__.return_value.cursor.return_value
            cursor_cm.__enter__.return_value.fetchone.return_value = (1,)

            for _ in range(3):
                response = self.client.get("/api/health/ready/")
                self.assertEqual(response.status_code, 200)

        self.assertEqual(mock_connections.__getitem__.return_value.cursor.call_count, 1)

    def test_debounced_readiness_result_expires_after_the_cache_window(self):
        """The mirror case of the test above: once the debounce window has
        elapsed, the next call must perform a fresh probe rather than
        serving a stale cached result forever. The window itself is
        patched down to 0 seconds here (rather than sleeping in the test)
        so this stays fast and deterministic.
        """
        with patch("apps.core.views._DB_CHECK_DEBOUNCE_SECONDS", 0):
            with patch("apps.core.views.connections") as mock_connections:
                cursor_cm = mock_connections.__getitem__.return_value.cursor.return_value
                cursor_cm.__enter__.return_value.fetchone.return_value = (1,)

                self.client.get("/api/health/ready/")
                self.client.get("/api/health/ready/")

            self.assertEqual(mock_connections.__getitem__.return_value.cursor.call_count, 2)


class ThrottleIdentitySpoofingTest(TestCase):
    """SEC-THROTTLE-001: docker-compose.prod.yml publishes the backend port
    directly and no reverse proxy is defined in this repo, so a caller can
    reach Django directly and set an arbitrary X-Forwarded-For header. DRF's
    SimpleRateThrottle.get_ident() trusts that header verbatim as the
    rate-limit identity whenever REST_FRAMEWORK's NUM_PROXIES is left at its
    library default of None -- letting a caller mint a fresh throttle bucket
    on every request just by varying X-Forwarded-For, completely defeating
    AnonRateThrottle/ScopedRateThrottle (login brute-force, contact/
    registration spam, payment-callback abuse, ...). Without the NUM_PROXIES
    fix in config/settings/base.py this test fails because get_ident()
    returns the attacker-controlled '198.51.100.9' instead of REMOTE_ADDR.

    This repo's own docker-compose.yml sets TRUST_PROXY_HEADERS=true in the
    backend container's real environment (for legitimate BFF reasons,
    unrelated to this fix), so REST_FRAMEWORK["NUM_PROXIES"] is genuinely 1
    when these tests run in their own home container. DRF's `api_settings`
    reads NUM_PROXIES live (not cached at import time), and Django's
    `override_settings` on the REST_FRAMEWORK dict correctly fires DRF's
    `setting_changed` receiver to refresh it -- confirmed interactively:
    `api_settings.NUM_PROXIES` reflects the override immediately inside the
    `with override_settings(...)` block and reverts after. So every
    behavioural assertion below pins NUM_PROXIES explicitly via
    override_settings instead of relying on the ambient container env,
    making the test deterministic regardless of TRUST_PROXY_HEADERS.
    """

    def setUp(self):
        self.factory = APIRequestFactory()

    def test_num_proxies_matches_trust_proxy_headers_flag(self):
        """config/settings/base.py computes NUM_PROXIES = 1 if
        TRUST_PROXY_HEADERS else 0 once, at settings-load time. Assert that
        invariant against whatever TRUST_PROXY_HEADERS actually is in this
        environment (True in this repo's own docker-compose.yml, False by
        default elsewhere) rather than hard-coding one side of it -- so this
        test is correct under both deployments instead of only ever passing
        in an environment that happens to match a hard-coded expectation.
        """
        expected_num_proxies = 1 if settings.TRUST_PROXY_HEADERS else 0
        self.assertEqual(settings.REST_FRAMEWORK["NUM_PROXIES"], expected_num_proxies)

    def test_spoofed_x_forwarded_for_is_ignored_for_throttle_identity(self):
        """Untrusted-default path: no reverse proxy in front of Django, so
        NUM_PROXIES must be 0 and the X-Forwarded-For header must be ignored
        entirely in favour of REMOTE_ADDR.
        """
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}):
            request = self.factory.get(
                "/api/accounts/login/",
                REMOTE_ADDR="203.0.113.5",
                HTTP_X_FORWARDED_FOR="198.51.100.9",
            )

            # get_ident() is shared, unoverridden, by every concrete throttle
            # class (AnonRateThrottle, ScopedRateThrottle, ...) -- BaseThrottle
            # exercises the exact same code path without needing a configured
            # rate for a scope.
            ident = BaseThrottle().get_ident(request)

            self.assertEqual(ident, "203.0.113.5")

    def test_a_caller_cannot_mint_a_fresh_throttle_bucket_per_request(self):
        """Untrusted-default path: varying X-Forwarded-For per request must
        not mint a fresh throttle identity each time.
        """
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}):
            throttle = BaseThrottle()
            idents = set()
            for spoofed_ip in ("198.51.100.1", "198.51.100.2", "198.51.100.3"):
                request = self.factory.get(
                    "/api/accounts/login/",
                    REMOTE_ADDR="203.0.113.5",
                    HTTP_X_FORWARDED_FOR=spoofed_ip,
                )
                idents.add(throttle.get_ident(request))

            self.assertEqual(idents, {"203.0.113.5"})

    def test_trusted_proxy_path_uses_the_proxy_appended_hop_not_client_input(self):
        """Opted-in trusted-proxy path (TRUST_PROXY_HEADERS=True ->
        NUM_PROXIES=1): a real reverse proxy in front of Django appends the
        client IP it saw to X-Forwarded-For (e.g. nginx's
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for), so
        whatever the client itself supplied ends up left of that. With
        NUM_PROXIES=1, DRF trusts only the single right-most (proxy-added)
        hop -- get_ident() must return that value, not the attacker-supplied
        left-most one.
        """
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            request = self.factory.get(
                "/api/accounts/login/",
                REMOTE_ADDR="10.0.0.1",  # the trusted proxy's own address
                HTTP_X_FORWARDED_FOR="198.51.100.9, 203.0.113.5",
            )

            ident = BaseThrottle().get_ident(request)

            self.assertEqual(ident, "203.0.113.5")

    def test_trusted_proxy_path_cannot_be_bypassed_by_spoofing_extra_hops(self):
        """Opted-in trusted-proxy path: a caller varying the left-most
        (client-controlled) hop it prepends must still resolve to the same
        throttle identity, since only the right-most (proxy-appended) hop is
        trusted.
        """
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            throttle = BaseThrottle()
            idents = set()
            for spoofed_ip in ("198.51.100.1", "198.51.100.2", "198.51.100.3"):
                request = self.factory.get(
                    "/api/accounts/login/",
                    REMOTE_ADDR="10.0.0.1",
                    HTTP_X_FORWARDED_FOR=f"{spoofed_ip}, 203.0.113.5",
                )
                idents.add(throttle.get_ident(request))

            self.assertEqual(idents, {"203.0.113.5"})
