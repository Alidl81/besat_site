# Observability Foundation

Structured logging, request-ID correlation, and Prometheus-compatible
metrics — implemented and verified live this session, not just designed.
Traces and alerting remain open (see "Not yet done" below).

## Structured JSON logging

**Before this session: no `LOGGING` setting existed at all** — Django's
bare implicit default applied (unstructured console text, no redaction,
no correlation). Implemented this session:

- `apps/core/logging_utils.py` — `JSONFormatter`, applied to every
  configured handler via `LOGGING` in `config/settings/base.py`. Every log
  line is one JSON object with `timestamp` (real microsecond precision —
  see the regression test below, which exists specifically because the
  first version of this formatter had a real bug here), `level`,
  `service`, `environment`, `logger`, `message`, plus whatever extra
  structured fields the call site attached.
- **Central redaction** (`redact()`/`redact_headers()`) — recursively
  strips any dict value under a sensitive-looking key (password, secret,
  token, authorization, cookie, session_id, api_key, card_number,
  national_code, etc. — kept in sync with the exact list in
  `docs/security/DATA_CLASSIFICATION.md`) at **any nesting depth**, with a
  bounded recursion depth so a pathological structure can't hang a log
  call. Applied automatically inside `JSONFormatter` to every `extra={}`
  field on every log record, project-wide — not something each call site
  has to remember to do itself.
- **9 automated tests** (`apps/core/test_logging.py`) proving: every field
  in the brief's exact "never log" list gets redacted; redaction works at
  arbitrary nesting depth (dict-in-dict, dict-in-list); ordinary
  (non-sensitive) fields pass through untouched; the formatter produces
  valid, parseable JSON with all required fields; and the timestamp bug
  specifically (see below) can't regress silently.

**Real bug found and fixed via this session's own testing, not assumed
correct**: the first implementation's timestamp used
`logging.Formatter.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ")`, which
silently produced literal `"...29.%fZ"` in every log line — Python's
`time.strftime` (what `formatTime` delegates to) doesn't understand `%f`
(microseconds); only `datetime.strftime` does. Caught by actually reading
live log output during verification, not by code review. Fixed by
switching to `datetime.fromtimestamp(record.created, tz=timezone.utc)`;
a dedicated regression test (`test_timestamp_has_real_microseconds_not_a_
literal_percent_f`) now guards against this specific regression.

## Request-ID correlation (browser → BFF → Django)

**Found already correctly implemented from a prior session** on the
frontend side (`frontend/src/app/api/backend/[...path]/route.ts` +
`frontend/src/lib/server/backend-client.ts`) — the BFF proxy already
generates or forwards `X-Request-ID` on every proxied call. **What this
session added**: the Django side had nothing consuming or echoing it.
`apps/core/middleware.py`'s `RequestLoggingMiddleware` now:

- Reads inbound `X-Request-ID` (or mints a fresh UUID4 if absent — e.g. a
  direct API call bypassing the frontend entirely still gets a stable ID)
- Attaches it to every request-summary log line, alongside `method`,
  `route` (the actual URL pattern, not just the raw path — useful for
  grouping `/api/shop/orders/<order_number>/` requests together
  regardless of the specific order number in each one), `status_code`,
  and `duration_ms`
- Echoes it back on the response (`X-Request-ID` header) so the browser/
  proxy side can correlate its own logs against the backend's

**Verified live, end-to-end, through the real running stack** — not just
via Django's test client:

```
$ (from inside the frontend container) fetch to /api/backend/units/
  with header X-Request-ID: e2e-verification-test-12345
→ response: status 200, x-request-id: e2e-verification-test-12345

$ docker compose logs backend | grep e2e-verification-test-12345
{"timestamp": "2026-08-19T04:23:17.269759Z", "level": "INFO",
 "service": "besat-backend", "environment": "debug",
 "logger": "besat.request", "message": "request",
 "request_id": "e2e-verification-test-12345", "method": "GET",
 "route": "api/units/$", "path": "/api/units/", "status_code": 200,
 "duration_ms": 22.7, "severity": "info"}
```

The same ID that the browser/BFF sent is the exact ID visible in the
backend's own structured log line for that request — a single request is
genuinely traceable across both services today, not just in design.

**Not yet done**: propagating the request ID onward to outgoing dependency
calls (Phase 4 — dependency resilience). No real outgoing dependency calls
exist yet to propagate it to (the payment provider is `mock`-only, no
email/SMS provider is configured — see `ARCHITECTURE.md`), so this is
correctly sequenced as future work, not a current gap with something to
attach to.

## Metrics (Prometheus-compatible)

Added `django-prometheus` (`requirements.txt`), wired via
`PrometheusBeforeMiddleware`/`PrometheusAfterMiddleware` (outermost in
`MIDDLEWARE`, per the library's own requirement) — this gives real HTTP
request metrics (count by method/status, latency histograms, in-progress
request gauge) automatically, project-wide, with zero per-view
instrumentation needed.

**Deliberately not exposed as an open public endpoint** — per the explicit
"do not expose Prometheus ... to the public Internet" requirement.
`django_prometheus.exports.ExportToDjangoView` (what actually serves the
metrics) has **zero authentication of its own by design** — confirmed
directly from the library's own documentation, which explicitly states it
performs no auth checks. `apps/core/views.py`'s `metrics_view` wraps it
behind the same internal-service-token gate already built for
`/api/health/deep/` (`X-Internal-Health-Token` against
`INTERNAL_HEALTH_TOKEN`, fails closed if unconfigured).

**Verified live** — 3 tests (`apps/core/tests.py`): no token → 403; wrong
token → 403; correct token → 200 with `Content-Type: text/plain` and a
real Prometheus metric name
(`django_http_requests_before_middlewares_total`) present in the body,
proving this is genuinely collecting real request data, not returning an
empty registry.

**Not yet done**:
- **Database-connection metrics** — `django-prometheus` also ships
  Prometheus-instrumented DB backend wrappers (e.g.
  `django_prometheus.db.backends.postgresql`), which would need swapping
  `DATABASES["default"]["ENGINE"]` — not done this session; deferred so
  as not to touch the DB engine configuration in the same session as the
  new timeout `OPTIONS` (`POSTGRESQL_RELIABILITY.md`) without isolating
  which change caused what, if anything regresses.
- **Host/container metrics** (CPU, RAM, disk, restarts, OOM) — these
  belong to a node/container exporter (e.g. `node_exporter`,
  `cadvisor`), not application-level instrumentation; not deployed this
  session.
- **Circuit-breaker state metrics** — moot until a real circuit breaker
  exists (Phase 4/12, no external dependency needs one yet — see
  `ARCHITECTURE.md`).
- **An actual Prometheus server to scrape this endpoint** — the endpoint
  exists and is correct; nothing is polling it yet. This is exactly the
  "metrics exist but nothing consumes them" gap the Ops Portal is meant to
  eventually close (once it exists).

## Traces

**Not implemented this session.** OpenTelemetry was evaluated as the
brief's own preferred standard; not added because there is no trace
backend (Jaeger/Tempo/etc.) to export to yet, and adding OTel
instrumentation with nowhere for spans to go would be unverifiable —
consistent with this session's standard of not marking something done
without a way to actually prove it works. Sequenced after a real trace
backend is stood up, alongside the reverse-proxy/edge work.

## What "observability foundation" means today, honestly

Logs are structured, redacted, and correlated end-to-end. Metrics are
real and correctly access-controlled. **Nothing is being watched yet** —
no Prometheus server scrapes `/api/metrics/`, no log aggregator ships
these JSON lines anywhere durable (they currently go to each container's
stdout, captured by Docker's default log driver, which — per
`FAILURE_MATRIX.md`'s STORAGE section — has no rotation/size cap
configured, a pre-existing gap this session's logging work makes more
important to close, not less). The foundation is real; the roof (actually
watching it) is Phase 13 (alerting) and the Ops Portal, both still ahead.
