# Besat — Actual System Architecture (as discovered)

**Status: this document describes what exists today, verified by reading the
real Docker Compose files, Dockerfiles, Django settings, and dependency
manifests in this repository — not an aspirational target.** Where the
target production architecture differs from today's reality, that is called
out explicitly rather than blended in.

Last verified: this session, against `besat_site` on `main`, working tree as
audited. Re-verify after any infrastructure change — this file will drift
otherwise.

## 0. The single most important fact

**There is no production infrastructure yet.** No CI/CD pipeline
(`.github/workflows` does not exist), no deployment scripts, no staging
environment, no reverse proxy, no cache, no queue, no observability stack, no
`ops.besat.org` / `status.besat.org` — none of it. What exists is:

- a local development Docker Compose stack (`docker-compose.yml`) that binds
  source directories into two hot-reloading containers plus a Postgres
  container, and
- a partially-started, unused-in-practice standalone backend deployment
  compose file (`backend/docker-compose.backend.yml`) that is closer to a
  real deployment shape (image-based, `init: true`, graceful shutdown grace
  period, named volumes for static/media) but has no frontend counterpart, no
  reverse proxy, and is not currently run by anyone.

Everything in this reliability/security program is therefore, honestly,
**greenfield design work layered onto a local dev stack**, not "harden an
existing production system." Phases that ask to audit existing production
monitoring, existing backups, existing alerting, etc. are answered with "does
not exist yet" rather than assumed findings.

## 1. Runtime topology (today — local dev, `docker-compose.yml`)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker host (single)                     │
│                                                                    │
│  ┌───────────────┐   depends_on    ┌──────────────┐              │
│  │  besat_db      │◄────service_healthy──┤ besat_backend │        │
│  │  postgres:16   │                 │  Django 5.2+  │              │
│  │  port: internal│                 │  gunicorn     │              │
│  │  (not exposed  │                 │  3 workers ×  │              │
│  │   to host)     │                 │  2 threads    │              │
│  └───────────────┘                 │  :8000 → host │              │
│                                     └──────┬────────┘              │
│                                            │ depends_on             │
│                                            │ service_healthy        │
│                                     ┌──────▼────────┐              │
│                                     │ besat_frontend │              │
│                                     │ Next.js 16.3.0 │              │
│                                     │ next dev       │              │
│                                     │ :3000 → host   │              │
│                                     └────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
              ▲
              │ browser (developer's machine)
```

**No reverse proxy exists in front of either service.** The frontend's own
Next.js route handler (`frontend/src/app/api/backend/[...path]/route.ts`) is
the *only* thing that proxies browser requests to the Django API — it is a
same-process BFF (Backend-for-Frontend) proxy, not a standalone reverse
proxy, and it runs inside the same container/process as the rest of the
Next.js app. If that Next.js process dies, both the site and the only proxy
path to the API die together.

**Postgres is not exposed to the host** in `docker-compose.yml` (no `ports:`
mapping) — only reachable from other containers on the compose network. This
is good practice already in place.

**The backend port (8000) *is* exposed directly to the host.** In local dev
this is harmless; in a naive lift-and-shift to a real host this would expose
Django directly to the internet with no reverse proxy, no TLS termination,
and no WAF in front of it. This must not happen in production — see
§6 Target Production Topology.

## 2. Frontend runtime

| Fact | Value | Source |
|---|---|---|
| Framework | Next.js 16.3.0 (App Router) | `frontend/package.json` |
| React | 19.2.4, single deduped instance (verified via `npm ls`) | — |
| Bundler | webpack, explicitly (`next dev --webpack`, `next build --webpack`) — Turbopack is not used | `package.json` scripts |
| Runtime | Node 22 (Alpine base image) | `frontend/Dockerfile` |
| Process model | Single Node process serves all SSR/RSC rendering, the BFF proxy, *and* holds the only path to the backend API | `docker-compose.yml` |
| Dev vs prod parity | **Dev never exercises the production build path.** `docker-compose.yml` overrides the Dockerfile's `CMD` to `npm run dev`; the Dockerfile's own `RUN npm run build` step (baked into every image build) is a completely different, never-locally-tested code path. This is exactly why the Phase 0 build blocker went undetected until this audit. | `frontend/Dockerfile` vs `docker-compose.yml` |
| Static/ISR | **Resolved.** Confirmed working — the real production Docker image (`docker build -f frontend/Dockerfile`) builds cleanly with true exit code 0, full static/dynamic route table generated. The build failures observed earlier in this session were isolated to the long-lived development container's accumulated state, not the framework, the codebase, or the real deployment artifact — see `docs/reliability/PHASE0_BUILD_BLOCKER.md` for the decisive tests. | this session |

## 3. Backend runtime

| Fact | Value | Source |
|---|---|---|
| Framework | Django 5.2–6.1 (range pin), DRF 3.15+ | `backend/requirements.txt` |
| App server | gunicorn (WSGI, sync workers), `--workers 3 --threads 2 --timeout 60` (all env-overridable) | `backend/entrypoint.sh` |
| ASGI | **Not used.** No Channels, no async views, no WebSocket support. Pure sync WSGI. | `requirements.txt`, `config/wsgi.py` present, no `asgi.py` referenced by entrypoint |
| DB driver | `psycopg[binary]` v3 | `requirements.txt` |
| DB connection pooling | **None.** No `CONN_MAX_AGE` set anywhere in settings (defaults to `0` — a new DB connection is opened and closed on every single request). | `config/settings/base.py` (absent) |
| Cache | **None.** No `CACHES` setting anywhere → Django's implicit default is `LocMemCache`, which is **per-process, not shared** across the 3 gunicorn worker processes. | `config/settings/*.py` (absent) |
| Queue / async workers | **None.** No Celery, no RQ, no django-q, no background task runner of any kind. Every operation (including, if ever wired, email/SMS sending) happens synchronously inside the request/response cycle today. | `requirements.txt` |
| Static files | WhiteNoise, serving compressed/manifested static assets directly from the Django process (no CDN, no separate static-file host) | `config/settings/base.py` `STORAGES["staticfiles"]` |
| Media storage | `FileSystemStorage` — local disk under `MEDIA_ROOT`, no S3/GCS/cloud object storage | `config/settings/base.py` |
| Auth | JWT via `djangorestframework-simplejwt`: 30 min access token, 7 day refresh token, rotation + blacklist-after-rotation enabled | `config/settings/base.py` `SIMPLE_JWT` |
| Authorization | DRF permission classes per view/viewset (role-based; see `apps/*/permissions.py` across apps) | codebase |
| Rate limiting | DRF's built-in throttle classes (`AnonRateThrottle`, `UserRateThrottle`, `ScopedRateThrottle`) with per-endpoint scoped rates (login: 5/min, registration: 3/hour, etc.) | `config/settings/base.py` `REST_FRAMEWORK` |
| **Rate-limit correctness caveat** | Because there is no shared cache (§ above), DRF throttling's counters live in each gunicorn worker's own `LocMemCache`. With 3 workers, the **effective** ceiling for any throttled endpoint is up to ~3× the configured rate, and a client that gets load-balanced across workers (which gunicorn's OS-level `accept()` round-robining does implicitly) can exceed the nominal limit. This is a real gap, not a theoretical one — see `docs/reliability/FAILURE_MATRIX.md` and `docs/security/ASVS_MATRIX.md` (V4 — rate limiting). | analysis, this session |
| Payments | `SHOP_PAYMENT_PROVIDER` env var, currently only a `"mock"` provider is registered/implemented — **no real payment gateway is integrated today.** This substantially reduces near-term PCI/financial-fraud exposure, but every payment-adjacent reliability/security requirement below is written against the *architecture*, ready for when a real provider is added, not against a live financial integration that doesn't exist yet. | `config/settings/base.py`, `apps/shop/payments/` |
| Email | SMTP via Django's built-in email backend if `EMAIL_HOST` is set; **console backend in dev, no backend configured for production yet** (`docker.env.example` ships no real SMTP credentials) | `config/settings/*.py` |
| SMS | **Not implemented anywhere in the codebase** (grepped; no SMS provider client exists) | this session |
| Logging | **No `LOGGING` setting anywhere.** Django's implicit default logging config applies: everything goes to console via a bare handler, no structured format, no security-event separation, no rotation, no level tuning beyond Django's own defaults. | `config/settings/*.py` (absent) |
| Health check | A single `/api/health/` endpoint that unconditionally returns `200 {"status": "ok."}` — it does **not** check database connectivity, cache, or any dependency. This is exactly the "one meaningless `/health`" anti-pattern; there is currently no distinction between liveness, readiness, and deep dependency health. | `apps/core/views.py` |
| Admin panel | Django's built-in `/admin/` is enabled (path configurable via `ADMIN_URL` env var) *in addition to* the custom-built CMS panels. Its existence as a second, separate privileged surface needs to be in the threat model. | `config/settings/base.py`, `ADMIN_URL` |
| API docs | `drf-spectacular`, gated by `ENABLE_API_DOCS` (defaults to `DEBUG` in local/test, must be explicitly enabled in production) | `config/settings/base.py` |

## 4. Data layer

- **PostgreSQL 16** (Alpine image), single instance, single container, no
  replica, no configured backup mechanism visible in this repository. This is
  a hard SPOF — see `docs/reliability/SPOF_AUDIT.md`.
- Named Docker volume `postgres_data` for durability across container
  restarts, but **not** across host loss — the volume lives on the same
  Docker host as everything else.
- No `pg_hba.conf`/`postgresql.conf` customization visible — running with
  the base image's defaults (default `max_connections`, no tuned
  `statement_timeout`, no `idle_in_transaction_session_timeout`).
- Migrations run automatically on every container start
  (`RUN_MIGRATIONS=1` default in `entrypoint.sh`) — convenient for dev,
  **dangerous for production** if ever run against multiple concurrent
  replicas of the backend without a migration-coordination strategy (see
  Phase 17 — deployment safety, to be addressed when multi-instance
  deployment is actually built).

## 5. Security posture already in place (verified, not assumed)

Real, working controls found in the codebase — listed here so the
security documents don't re-litigate what's already correct:

- `config/settings/production.py`: `SECURE_SSL_REDIRECT=True` (default),
  `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`,
  `SECURE_HSTS_SECONDS` = 30 days with `includeSubDomains` + `preload`
  (all defaults, env-overridable), `X_FRAME_OPTIONS = "DENY"`.
- `SECRET_KEY` has **no default** in `production.py` (`env("SECRET_KEY")`
  with no fallback) — Django will refuse to start rather than run with a
  guessable key. Correct fail-closed behavior.
- `SECURE_CONTENT_TYPE_NOSNIFF = True` globally.
- `TRUST_PROXY_HEADERS` is opt-in (`default=False`) and documented in-line
  as to exactly why it's dangerous to enable without a trusted,
  header-overwriting proxy in front — correct, cautious design.
- CSRF middleware active; `CSRF_TRUSTED_ORIGINS` explicitly configured
  per-environment via env var, not wildcarded.
- CORS via `django-cors-headers`, explicit allow-list via
  `CORS_ALLOWED_ORIGINS`, not `CORS_ALLOW_ALL_ORIGINS`.
- Password validators: Django's standard four (similarity, minimum length,
  common password, numeric-only rejection) — baseline, not customized/
  strengthened yet.
- JWT refresh rotation + blacklist-after-rotation — prevents replay of a
  used refresh token.
- `nh3` (Rust HTML sanitizer) used for CMS rich-content sanitization on both
  the backend (`apps/content/rich_text.py`) and mirrored on the frontend
  (`sanitizeCmsHtml`) — real, working stored-XSS defense for user/editor
  generated HTML, not a theoretical gap.
- `docker.env` (the one file that would hold real production secrets for the
  standalone backend compose variant) is correctly gitignored and, as
  currently checked into the working tree, contains only placeholder
  `change-me` values — no real secret leak found here.

## 6. Target production topology (design, not yet built)

Per the stated target domains (`besat.org`, `ops.besat.org`,
`status.besat.org`), here is the architecture this program is designing
toward. This section is the target; §1–5 are the baseline it starts from.

```
                              Internet
                                 │
                    ┌────────────┴────────────┐
                    │   DNS (besat.org zone)    │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                          │
   besat.org               ops.besat.org              status.besat.org
   www.besat.org        (independent failure          (independent failure
        │                 domain — separate            domain — must stay
        │                 process/container            up even if besat.org
        │                 minimum, stronger             is fully down)
        │                 isolation preferred)
        │                        │
  ┌─────▼─────┐          ┌───────▼────────┐
  │  Reverse   │          │  Ops Portal     │
  │  proxy /   │          │  (separate app, │
  │  TLS term. │          │  separate auth, │
  │  (does not │          │  MFA-only)      │
  │  exist yet)│          └───────┬────────┘
  └─────┬─────┘                  │ reads telemetry from a
        │                        │ store independent of the
  ┌─────▼─────────────┐          │ main app's own health
  │ Next.js (N replicas│◄─────────┘
  │ once this is real) │
  └─────┬──────────────┘
        │ BFF proxy → internal network only
  ┌─────▼─────────────┐
  │ Django/gunicorn    │
  │ (N replicas)        │
  └─────┬──────────────┘
        │
  ┌─────▼──────┐   ┌──────────┐   ┌───────────────┐
  │ PostgreSQL  │   │  Redis   │   │ Object storage │
  │ primary +   │   │ (cache + │   │ (media, off-   │
  │ standby     │   │  future  │   │  host backups) │
  │ (does not   │   │  queue)  │   │ (does not      │
  │  exist yet) │   │(does not │   │  exist yet)    │
  └────────────┘   │ exist yet)│   └───────────────┘
                    └──────────┘
```

Key target decisions carried through the rest of this program:

- **Ops Portal is a separate service/container at minimum**, with its own
  auth store, so `besat.org`'s failure does not take Ops visibility down
  with it.
- **Redis** is the first piece of shared infrastructure to add — it fixes
  both the per-worker rate-limiting gap (§3) and gives the app a real cache
  layer, and doubles as a queue backend if/when async email/SMS/webhook
  processing is introduced.
- **Object storage** (S3-compatible) replaces `FileSystemStorage` so media
  survives host loss and can be backed up independently of the app host.
- **PostgreSQL primary/standby** replaces the single instance — sized and
  scheduled appropriately for actual budget, not assumed to already exist.

## 7. Failure domains (today, as actually deployed)

Because everything currently runs on one Docker host with no reverse proxy,
no cache, and no queue, **the practical failure domain today is "the whole
Docker host."** There is no meaningful sub-domain isolation yet:

- Frontend down → BFF proxy down → API unreachable even though Django is
  healthy (frontend is a SPOF for API access, not just for rendering).
- Backend down → frontend still serves static shell/JS, but every
  data-dependent page fails (no cached/degraded fallback exists anywhere in
  the frontend data layer today — every `getPublicX()` call either succeeds
  or the calling component shows its own ad hoc empty/error state).
- DB down → backend's health check still returns `200` (it doesn't check the
  DB) — **this is a real, verified false-positive health signal**, meaning
  an orchestrator relying on this health check would keep routing traffic to
  a backend that cannot actually serve any data-dependent request.
- Docker host down → everything down, including Ops visibility (Ops Portal
  does not exist yet, and even if it did in-process today, it would go down
  with everything else — exactly what §6 is designed to prevent).

This is the honest starting point for `docs/reliability/FAILURE_MATRIX.md`
and `docs/reliability/SPOF_AUDIT.md`.
