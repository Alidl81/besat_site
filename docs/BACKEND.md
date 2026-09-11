# Besat backend

This is the canonical backend contract and engineering-status document for the
Besat site. It describes the local checkout and the evidence available here;
it is not a production deployment approval.

## Release position

The backend changes in this engineering pass are locally complete and the
regression suite is green. The correct release boundary remains **staging load
and production acceptance required**: the controlled local run did not prove
3,000 concurrent users.

| Check | Result |
| --- | --- |
| Django test suite | 658 tests passed in 39.663 s (final rerun) |
| Production-settings guard subset | 31 tests passed |
| `makemigrations --check --dry-run` | no changes detected |
| Migration plan | all migrations applied |
| Local Docker health | PostgreSQL and backend healthy; frontend running |
| Normal navigation replay | 140/140 HTTP 200, 0 errors |
| OpenAPI generation | 190 paths, 303 operations; validation warnings/errors remain |

## Architecture and process model

The backend is a Django 5/DRF application in `backend/` with PostgreSQL as
the supported production database. The app modules are `accounts`, `about`,
`achievements`, `announcements`, `contact`, `content`, `core`, `dashboard`,
`departments`, `events`, `gallery`, `home`, `news`, `registration`, `shop`,
`site_settings`, `staff`, `units`, and `virtual_tour`.

The supported compose topology is:

```text
browser -> (optional operator reverse proxy) -> Next BFF -> Gunicorn/Django
                                                   |          |
                                                   |          +-- PostgreSQL 16
                                                   +-- shared media/static volumes
```

The local compose file exposes the development services on ports 3000 and
8000. The production compose file binds the application ports to loopback and
expects the operator's reverse proxy/TLS boundary outside this repository.
The backend command is Gunicorn with three workers, two gthread threads per
worker, and a 60 second request timeout. There is no Redis, PgBouncer, task
queue, in-repo reverse proxy, or multi-host autoscaler in the current stack.

PostgreSQL connections set a 30 second statement timeout, 60 second idle
transaction timeout, and 10 second lock timeout. Static and media files use
the mounted volumes configured by compose. The entrypoint runs the required
migration/collectstatic steps; it does not reset or reseed legitimate data.

## Authentication and authorization

- Django REST Framework defaults to JWT authentication and
  `IsAuthenticated`. The Next BFF keeps browser-facing calls same-origin and
  forwards the session cookies to Django.
- Public catalog/read endpoints explicitly use `AllowAny`.
- CMS writes and dashboard APIs require an authenticated active profile and the
  resource's role permission. General managers have global management access;
  unit managers and unit media users are restricted to their membership/unit
  scope; parents can access only their own children, registrations, messages,
  and orders.
- Workflow actions (publish, approve, reject, archive, restore, schedule,
  refunds, and status transitions) use explicit permission classes and object
  scope checks. A caller cannot select another unit by changing an ID in the
  URL or body.
- Payment callbacks are provider-facing endpoints and validate the provider
  contract; the mock provider is local-only and is rejected by production
  settings until a real provider implementation is configured.

The 658-test suite includes role isolation, object ownership, cross-unit write
rejection, registration ownership, cart/order ownership, message access, and
workflow authorization tests. Authorization is therefore a passing local gate,
subject to the staging environment using the same settings and migrations.

## Anonymous identity and throttling

The previous normal-navigation failure was a single proxy IP bucket. The fix is
deliberately shared by Next and Django:

1. Next creates an opaque UUID in the `besat_anon_id` HttpOnly, SameSite=Lax
   cookie.
2. The BFF signs the identity with `BESAT_ANON_THROTTLE_SECRET` and sends only
   `identity.signature` in `X-Besat-Anonymous-Id`.
3. Django verifies the HMAC and uses `bff:<identity>` as the anonymous throttle
   key. Invalid or spoofed headers fall back to the real client identity.
4. The production settings guard rejects a missing, short, or known-placeholder
   shared secret. The frontend BFF fails closed in production when it cannot
   create a signed identity.

The configured DRF classes are `BFFAnonRateThrottle`, `UserRateThrottle`, and
`BFFScopedRateThrottle`. Rates are:

| Scope | Rate | Applies to |
| --- | --- | --- |
| `anon` | 600/hour | public anonymous requests, per signed browser identity |
| `user` | 1000/hour | authenticated requests |
| `login` | 5/minute | login |
| `refresh` | 20/minute | token refresh |
| `contact` | 5/hour | contact submission |
| `registration` | 3/hour | registration submission |
| `password_change` | 5/hour | password change |
| `set_password` | 10/hour | first-time/set-password flow |
| `customer_registration` | 5/hour | shop/customer registration |
| `checkout` | 20/hour | order creation/checkout |
| `payment_callback` | 60/hour | provider callback |

The effective anonymous identity is not the shared container IP. With no
trusted proxy, `NUM_PROXIES=0` ignores spoofable forwarded headers. It becomes
`1` only when `TRUST_PROXY_HEADERS=true` and the operator has a proxy that
overwrites the forwarded chain. This is the explicit client-IP boundary behind
the BFF.

Evidence from the local replay: 14 warmed public/BFF paths repeated ten times
produced 140/140 HTTP 200 responses with no errors. A single signed identity
sent 610 unit requests and received 600 HTTP 200 followed by 10 HTTP 429, with
the first 429 at request 601 and `Retry-After: 3549`; a second identity remained
available. This is an intentional approximately one-hour per-browser budget,
not a global navigation lockout.

The throttle cache is a shared Django `FileBasedCache` with a configurable
location, one-hour default timeout, and 100,000-entry cap. It removes the
multi-worker `LocMemCache` split-brain, but file locking and synchronous writes
are part of the measured capacity bottleneck. A horizontally scaled deployment
should move this cache to a shared low-latency service before increasing rates.

## Database, data, and uploads

- PostgreSQL 16 is the production database. SQLite is for tests/local fallback
  only. Migrations are committed and currently applied.
- Querysets use indexes and DRF pagination (`count`, `next`, `previous`,
  `results`) where a list can grow. PostgreSQL statement/lock timeouts protect
  workers from unbounded queries.
- Public units filter out internal development records. Existing legitimate
  organization/contact/unit data is preserved; this pass does not wipe or
  reseed business tables.
- Upload endpoints validate size/type/content across accounts, announcements,
  events, achievements, home slides, gallery/media, news, virtual tour, staff,
  and shop assets. Django memory/file upload ceilings are 10 MiB and 5 MiB.
  `Department.icon` and Site Settings image fields are still a P2 hardening
  item because their model fields do not carry the same explicit max-size
  validator; those fields are not exposed as public anonymous write endpoints.
- Payment state transitions and refunds are explicit order events. A real
  provider, secret, callback signature policy, and staging reconciliation are
  required before production payment acceptance.

## Security and operational findings

Passing local controls include origin checks on BFF mutations, secure session
cookie attributes in production, forwarded-header gating, upload validation,
JWT authentication, object-level authorization, parameterized ORM/SQL, and
health/readiness separation. Source review found no unsafe `eval`, `exec`,
`pickle`, unsafe YAML load, shell execution, or user-input SQL interpolation.

The following are findings rather than silently assumed passes:

- `manage.py spectacular --validate` exits successfully but emits 94 warnings
  (48 unique) and 36 schema errors (8 unique). The errors are concentrated in
  dashboard/panel APIViews without serializers; warnings include unresolved
  method-field hints, duplicate `UnitBrief` component names, untyped IDs, and
  an operation-id collision. Runtime tests pass, but generated OpenAPI is not a
  clean contract yet.
- `pip-audit` and Bandit are not installed in the backend image. Frontend
  `npm audit --omit=dev --audit-level=high --json` was blocked by an
  `ECONNRESET` to the npm advisory service. Dependency/SAST status is therefore
  **blocked by tooling/network**, not certified clean.
- There is no committed CI workflow, Prometheus collector, managed backup
  automation, Redis/PgBouncer layer, or in-repo reverse proxy. These are
  staging/production engineering requirements, not reasons to claim that the
  local app is broken.
- A valid production-environment `manage.py check` passed. The bounded
  `manage.py check --deploy` probe did not complete in this local container
  within 30 seconds, so deploy-check output is recorded as unverified rather
  than claimed clean.
- The local single database/container is a single-host failure domain. Use
  managed PostgreSQL, backups/restore drills, external metrics/log shipping,
  and a load-tested proxy/cache before a public launch.

## API contract conventions

The canonical generated inventory below has 190 paths and 303 operations.
Unless a path's permission row says otherwise:

- list GETs return the standard paginated envelope and accept the filters,
  search, ordering, and page controls implemented by the view;
- detail GETs return one serializer object or 404;
- successful create returns 201, update/action returns 200, delete returns
  204;
- validation is 400, unauthenticated is 401, forbidden/object-scope failure is
  403, missing objects are 404, and a throttle response is 429 with
  `Retry-After`;
- JSON is the default parser/renderer. File upload actions use multipart and
  the validators described above.

### Permission and side-effect matrix

| Path family | Read access | Write/action access | Main side effect/throttle |
| --- | --- | --- | --- |
| `/api/about`, `/api/achievements`, `/api/announcements`, `/api/departments`, `/api/events`, `/api/gallery`, `/api/home`, `/api/news`, `/api/site-settings`, `/api/staff`, `/api/units`, `/api/virtual-tour`, public shop catalog | public | none | cacheable public content |
| `/api/contact`, `/api/messages` | public GET or public submission | public POST with validation | `contact`/`anon` throttle; creates a contact/message record |
| `/api/registration`, `/api/registration-requests` | public registration surface | public POST with validation | `registration`/`customer_registration` throttle; creates a request |
| `/api/auth/*` | public authentication boundary | public POST | login/refresh scoped throttles; sets or rotates JWT session |
| `/api/health/*`, `/api/metrics` | health/readiness public as configured; deep/metrics token-gated | none | probes DB/cache; never expose secrets |
| `/api/me/*`, `/api/parents/*`, `/api/shop/cart`, `/api/shop/addresses`, `/api/shop/orders`, `/api/shop/payments/start` | authenticated active profile | owner or parent role | user/order ownership and relevant scoped throttle |
| `/api/dashboard/*` | authenticated active profile | role-specific | role/unit-scoped dashboard data |
| `/api/cms/*` | authenticated active profile, resource dependent | general manager, unit manager/media, or resource permission | CRUD/workflow, object scope, audit/event records |
| `/api/shop/payments/callback/{provider}` | provider callback contract | provider-signed GET/POST | callback throttle and idempotent payment transition |

## Canonical operation inventory

Every operation in the generated schema is listed here. The trailing slash is
part of the canonical Django route.

### Public and authentication

- `/api/about/`: GET
- `/api/achievements/`: GET
- `/api/achievements/{slug}/`: GET
- `/api/announcements/`: GET
- `/api/announcements/categories/`: GET
- `/api/announcements/{slug}/`: GET
- `/api/auth/login/`: POST
- `/api/auth/logout/`: POST
- `/api/auth/refresh/`: POST
- `/api/auth/register/`: POST
- `/api/auth/set-password/`: POST

### CMS content and editorial resources

- `/api/cms/achievements/`: GET, POST
- `/api/cms/achievements/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/announcements/categories/`: GET, POST
- `/api/cms/announcements/categories/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/classes/`: GET, POST
- `/api/cms/classes/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/content/`: GET, POST
- `/api/cms/content/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/content/{id}/approve/`: POST
- `/api/cms/content/{id}/archive/`: POST
- `/api/cms/content/{id}/publish/`: POST
- `/api/cms/content/{id}/reject/`: POST
- `/api/cms/content/{id}/restore/`: POST
- `/api/cms/content/{id}/revisions/`: GET
- `/api/cms/content/{id}/revisions/{revision_id}/restore/`: POST
- `/api/cms/content/{id}/schedule/`: POST
- `/api/cms/content/{id}/submit-review/`: POST
- `/api/cms/departments/`: GET, POST
- `/api/cms/departments/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/events/`: GET, POST
- `/api/cms/events/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/events/{id}/approve/`: POST
- `/api/cms/events/{id}/archive/`: POST
- `/api/cms/events/{id}/publish/`: POST
- `/api/cms/events/{id}/reject/`: POST
- `/api/cms/events/{id}/restore/`: POST
- `/api/cms/events/{id}/submit-review/`: POST
- `/api/cms/gallery/`: GET, POST
- `/api/cms/gallery/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/gallery/{id}/approve/`: POST
- `/api/cms/gallery/{id}/archive/`: POST
- `/api/cms/gallery/{id}/publish/`: POST
- `/api/cms/gallery/{id}/reject/`: POST
- `/api/cms/gallery/{id}/restore/`: POST
- `/api/cms/gallery/{id}/submit-review/`: POST
- `/api/cms/home-slides/`: GET, POST
- `/api/cms/home-slides/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/internal-messages/`: GET, POST
- `/api/cms/internal-messages/recipients/`: GET
- `/api/cms/internal-messages/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/internal-messages/{id}/mark-read/`: POST
- `/api/cms/media/`: GET, POST
- `/api/cms/media/{id}/`: DELETE, GET
- `/api/cms/messages/`: GET, POST
- `/api/cms/messages/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/news/categories/`: GET, POST
- `/api/cms/news/categories/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/programs/`: GET, POST
- `/api/cms/programs/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/registration-requests/`: GET, POST
- `/api/cms/registration-requests/summary/`: GET
- `/api/cms/registration-requests/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/registration-requests/{id}/approve/`: POST
- `/api/cms/registration-requests/{id}/contact/`: POST
- `/api/cms/registration-requests/{id}/reject/`: POST
- `/api/cms/registration-requests/{id}/request-documents/`: POST
- `/api/cms/registrations-requests/`: GET, POST
- `/api/cms/registrations-requests/summary/`: GET
- `/api/cms/registrations-requests/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/registrations-requests/{id}/approve/`: POST
- `/api/cms/registrations-requests/{id}/contact/`: POST
- `/api/cms/registrations-requests/{id}/reject/`: POST
- `/api/cms/registrations-requests/{id}/request-documents/`: POST
- `/api/cms/registrations/`: GET, POST
- `/api/cms/registrations/summary/`: GET
- `/api/cms/registrations/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/registrations/{id}/approve/`: POST
- `/api/cms/registrations/{id}/contact/`: POST
- `/api/cms/registrations/{id}/reject/`: POST
- `/api/cms/registrations/{id}/request-documents/`: POST
- `/api/cms/reports/export/`: GET
- `/api/cms/reports/overview/`: GET
- `/api/cms/services/`: GET
- `/api/cms/settings/`: GET, PATCH

### CMS shop, people, and virtual tour

- `/api/cms/shop/categories/`: GET, POST
- `/api/cms/shop/categories/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/shop/course-enrollments/`: GET
- `/api/cms/shop/orders/`: GET
- `/api/cms/shop/orders/{id}/`: GET
- `/api/cms/shop/orders/{id}/cancel/`: POST
- `/api/cms/shop/orders/{id}/events/`: GET
- `/api/cms/shop/orders/{id}/mark-completed/`: POST
- `/api/cms/shop/orders/{id}/mark-processing/`: POST
- `/api/cms/shop/orders/{id}/mark-shipped/`: POST
- `/api/cms/shop/orders/{id}/partial-refund/`: POST
- `/api/cms/shop/orders/{id}/refund/`: POST
- `/api/cms/shop/payments/`: GET
- `/api/cms/shop/payments/{id}/`: GET
- `/api/cms/shop/products/`: GET, POST
- `/api/cms/shop/products/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/shop/products/{id}/approve/`: POST
- `/api/cms/shop/products/{id}/archive/`: POST
- `/api/cms/shop/products/{id}/publish/`: POST
- `/api/cms/shop/products/{id}/reject/`: POST
- `/api/cms/shop/products/{id}/restore/`: POST
- `/api/cms/shop/products/{id}/submit-review/`: POST
- `/api/cms/shop/products/{id}/upload-image/`: POST
- `/api/cms/shop/settings/`: GET, PATCH
- `/api/cms/shop/shipping-methods/`: GET, POST
- `/api/cms/shop/shipping-methods/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/staff/`: GET, POST
- `/api/cms/staff/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/static-pages/`: GET, POST
- `/api/cms/static-pages/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/students/`: GET, POST
- `/api/cms/students/summary/`: GET
- `/api/cms/students/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/units/`: GET, POST
- `/api/cms/units/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/users/`: GET, POST
- `/api/cms/users/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/virtual-tour/hotspots/`: GET, POST
- `/api/cms/virtual-tour/hotspots/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/virtual-tour/scenes/`: GET, POST
- `/api/cms/virtual-tour/scenes/{id}/`: DELETE, GET, PATCH, PUT
- `/api/cms/virtual-tour/scenes/{id}/approve/`: POST
- `/api/cms/virtual-tour/scenes/{id}/archive/`: POST
- `/api/cms/virtual-tour/scenes/{id}/publish/`: POST
- `/api/cms/virtual-tour/scenes/{id}/reject/`: POST
- `/api/cms/virtual-tour/scenes/{id}/restore/`: POST
- `/api/cms/virtual-tour/scenes/{id}/submit-review/`: POST

### Public, dashboard, account, parents, and shop

- `/api/contact/`: GET, POST
- `/api/content/`: GET
- `/api/dashboard/context/`: GET
- `/api/dashboard/general-manager/`: GET
- `/api/dashboard/media/`: GET
- `/api/dashboard/parents/`: GET
- `/api/dashboard/unit-manager/`: GET
- `/api/departments/`: GET
- `/api/departments/{slug}/`: GET
- `/api/events/`: GET
- `/api/events/{slug}/`: GET
- `/api/gallery/`: GET
- `/api/gallery/{slug}/`: GET
- `/api/health/`: GET
- `/api/health/deep/`: GET
- `/api/health/live/`: GET
- `/api/health/ready/`: GET
- `/api/home/`: GET
- `/api/home/slides/`: GET
- `/api/me/`: GET
- `/api/me/change-password/`: POST
- `/api/me/permissions/`: GET
- `/api/me/profile/`: GET, PATCH
- `/api/me/profile/avatar/`: POST
- `/api/me/units/`: GET
- `/api/messages/`: POST
- `/api/news/`: GET
- `/api/news/categories/`: GET
- `/api/news/{slug}/`: GET
- `/api/parents/children/`: GET
- `/api/parents/children/{id}/`: GET
- `/api/parents/programs/`: GET
- `/api/parents/registrations/`: GET
- `/api/registration-requests/`: POST
- `/api/registration/`: GET, POST
- `/api/shop/addresses/`: GET, POST
- `/api/shop/addresses/{id}/`: DELETE, GET, PATCH
- `/api/shop/cart/`: GET
- `/api/shop/cart/items/`: POST
- `/api/shop/cart/items/{item_id}/`: DELETE, PATCH
- `/api/shop/cart/merge/`: POST
- `/api/shop/categories/`: GET
- `/api/shop/checkout/preview/`: POST
- `/api/shop/courses/my/`: GET
- `/api/shop/orders/`: GET, POST
- `/api/shop/orders/{order_number}/`: GET
- `/api/shop/payments/callback/{provider}/`: GET, POST
- `/api/shop/payments/start/`: POST
- `/api/shop/products/`: GET
- `/api/shop/products/{slug}/`: GET
- `/api/shop/shipping-methods/`: GET
- `/api/site-settings/`: GET
- `/api/staff/`: GET
- `/api/staff/{slug}/`: GET
- `/api/units/`: GET
- `/api/units/{slug}/`: GET
- `/api/virtual-tour/scenes/`: GET
- `/api/virtual-tour/scenes/{slug}/`: GET

## Health, observability, and operations

- `/api/health/live/` is a process liveness probe.
- `/api/health/ready/` checks the database and returns 503 when it cannot be
  reached; `/api/health/deep/` is a deeper operator probe.
- `/api/metrics/` is protected by the configured metrics token when the
  Prometheus package is available; the local image has a safe fallback.
- Requests carry a request ID and structured JSON logs. Logs intentionally do
  not include passwords, tokens, payment secrets, or uploaded file contents.
- Backups, restore drills, external log/metric shipping, TLS, and the reverse
  proxy are operator responsibilities for staging/production.

## Capacity result

### `NOT_READY_FOR_3000_CONCURRENT`

The run used read-only local GETs against the Docker stack and stopped when the
2,000 stage produced transport timeouts. It did not fabricate a 3,000-user
result.

| Stage | Outcome | RPS | p50 | p95 | p99 | HTTP error rate |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 50 | 50 x 200 | 78.81 | 231.3 ms | 610.8 ms | n/a | 0% |
| 100 | 100 x 200 | 85.16 | 419.6 ms | 1077.4 ms | n/a | 0% |
| 250 | 250 x 200 | 117.43 | 940.9 ms | 1977.7 ms | n/a | 0% |
| 500 | 500 x 200 | 98.42 | 1724.7 ms | 4581.8 ms | n/a | 0% |
| 1000 | 1000 x 200 | **90.83** | **4119.9 ms** | **10195.9 ms** | **10788.8 ms** | **0%** |
| 2000 attempted | 1000 x 200, 1000 transport timeouts | 65.82 attempted | 16186.3 ms | 30363.5 ms | 30372.6 ms | **50% timeout** |

The highest fully successful stage was 1,000 concurrent requests. No clean
3,000 stage was run. The primary bottleneck is the single-container Gunicorn
gthread pool (3 workers x 2 threads) combined with synchronous PostgreSQL and
file-based throttle-cache writes; local CPU and filesystem behavior also limit
the result. A staging test with a production-shaped proxy, shared cache,
managed PostgreSQL, metrics, and realistic browser/API mixes is required.

## Findings and acceptance gates

- **P0 remaining:** 0 locally identified.
- **P1 remaining:** 0 locally identified.
- **P2:** OpenAPI schema quality (36 errors/94 warnings); dependency/SAST
  tooling/network blocked; missing production-grade shared cache, proxy,
  observability, backup automation, and multi-host capacity proof; explicit
  upload limits for `Department.icon`/Site Settings images; real payment
  provider/staging reconciliation still required.
- **P3:** Add committed CI/coverage gates, automated schema linting, and a
  repeatable external load harness; document and monitor cache/worker saturation
  over time.

This means the engineering outcome is **ready for staging load and production
acceptance, with more local engineering required before a production claim**.
Do not deploy solely from this document, and do not treat the local 1,000-user
stage as a 3,000-user guarantee.

## Evidence index

Detailed local results, route counts, dependency-tool limitations, and the
browser/normal-navigation replay are retained in
`.audit/backend/final-engineering-evidence.md`. The original audit history and
release-gate material under `.audit/` is intentionally preserved.
