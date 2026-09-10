# Production Deployment (SEC-CONFIG-001)

This document exists because the repository previously had exactly one
Docker Compose file (`docker-compose.yml`, the root-level developer/local-
QA composition), which hardcodes `DJANGO_SETTINGS_MODULE=config.settings.
local` and `DEBUG` defaulting to `1` directly in the service definition.
That file is correct and untouched for its actual purpose (local
development), but it was also the *only* way to run this project in
Docker, meaning there was no explicit, safe path to a real deployment.
This document and `docker-compose.prod.yml` are that path.

## Two separate purposes, never mixed

| | Developer / local QA | Production |
|---|---|---|
| Compose file | `docker-compose.yml` (repo root) | `docker-compose.prod.yml` (repo root) |
| Backend settings | `config.settings.local` | `config.settings.production` |
| `DEBUG` | `1` (default) | Hardcoded `False`, cannot be overridden by env |
| Backend source | Bind-mounted from host (`./backend:/app`) | Baked into the built image only |
| Frontend command | `npm run dev` (hot reload) | The image's own `next start` (never overridden) |
| Secrets | Inline defaults in the compose file (`${VAR:-dev-value}`) | Required, gitignored env files — no defaults, no placeholders accepted |
| Config validation | None (deliberately permissive for iteration) | Fails closed — refuses to start on any unsafe value |

Never point `docker-compose.prod.yml` at the same named volumes/containers
as `docker-compose.yml` (it doesn't — see "Isolation" below) and never
"upgrade" the developer compose into a production one in place; keep them
structurally separate so there is never ambiguity about which one is
running.

## What already existed and was reused, not rebuilt

An audit before writing anything found this project already had most of
the pieces a production deployment needs:

- **Gunicorn**, not `runserver`, is already what `backend/entrypoint.sh`
  execs unconditionally — true for both compose files, nothing to change.
- **`next start`**, not `next dev`, is already `frontend/Dockerfile`'s own
  `CMD` — the production image was already correct; only the *developer*
  compose overrides it to `npm run dev` for hot-reload convenience.
- **`config/settings/production.py`** already hardcoded `DEBUG = False`,
  required `SECRET_KEY` from the environment with no fallback, forced
  `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE = True`, and set sensible
  HSTS defaults. It just was never the settings module the one existing
  compose file actually selected.
- **`TRUST_PROXY_HEADERS`** (`config/settings/base.py`) already defaults
  to `False` and only trusts `X-Forwarded-Proto` when explicitly enabled
  — correct "only when actually behind a trusted reverse proxy" behavior,
  unchanged.
- **`backend/docker-compose.backend.yml`** and **`backend/docker.env.
  example`** already existed as a solid backend-only production-style
  pattern (required env file, no source bind-mount, no exposed DB port,
  named volumes for static/media) — `docker-compose.prod.yml` follows the
  same pattern and reuses `backend/docker.env` as its actual secrets file,
  rather than inventing a second one.
- **`docker build -f frontend/Dockerfile`** was already independently
  verified to build cleanly (see `PHASE0_BUILD_BLOCKER.md`).

## What was added this session

1. **`backend/config/settings/_production_guard.py`** + wiring at the
   bottom of `production.py` — fail-closed validation that runs for
   *every* process that imports production settings (gunicorn, `manage.py
   migrate`, a one-off shell — not just `manage.py check --deploy`, which
   requires someone to remember to run it). Refuses to start
   (`ImproperlyConfigured`, non-zero exit) if: `DEBUG` is true;
   `SECRET_KEY` is missing, too short, or matches a known placeholder
   pattern from this repo's own example env files; `ALLOWED_HOSTS` is
   empty or contains `*`; `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` is
   empty; the secure-cookie flags are off; `DATABASE_URL` is missing (it
   would otherwise silently resolve to a non-persistent local SQLite file
   — `config/settings/base.py`'s own fallback default — so a production
   container could run happily and lose everything on its next restart);
   or `SHOP_PAYMENT_PROVIDER` is `"mock"` (its callback endpoint is
   `AllowAny` and trusts a caller-supplied `outcome=success` directly —
   see `apps/shop/payments/mock_provider.py`). Unit-tested in
   `test_production_guard.py` (27 tests), including subprocess-level tests
   that actually run `manage.py check` against the real module with broken
   env and confirm it fails, and a real isolated Docker image build/run
   this session confirmed the same against the actual built artifact (see
   `.agents/collab/claude/FIXES.md`, SEC-CONFIG-001 entry, for the exact
   commands and output, including the round where an independent review
   caught two real gaps in the first draft — see "Independent review
   caught real gaps" below).
2. **`ensure_cms_admin`** (the real admin bootstrap, wired into
   `entrypoint.sh`) no longer silently resets an *existing* administrator's
   password on a normal restart/redeploy — only a first-time bootstrap
   sets the password from the env var now; an explicit, separate
   `CMS_ADMIN_FORCE_RESET=1` is required to force a reset of an existing
   account. Also refuses to bootstrap with a placeholder-looking password
   outside of local development. See `apps/core/test_ensure_cms_admin.py`.
3. **`seed_dev_accounts`** (creates `dev_admin`/`dev_media`/`dev_parent`
   test accounts with guessable usernames) now technically refuses to run
   at all when `settings.DEBUG` is false, backing up what its docstring
   already claimed. See `apps/accounts/test_seed_dev_accounts.py`.
4. **`docker-compose.prod.yml`** (repo root) — db + backend + frontend,
   production settings/images only, no source bind-mounts, no public
   Postgres port, reuses `backend/docker.env` (required, gitignored) for
   backend/db config and a new `frontend/.env.production` (required,
   gitignored) for frontend config.
5. **`frontend/.env.production.example`** — template for the frontend's
   production runtime config (site URL, internal backend URL). No secrets
   involved on the frontend side.
6. **`backend/docker.env.example`** updated to document
   `CMS_ADMIN_FORCE_RESET` and the fail-closed validation behavior (it was
   already the right template otherwise; also had no `CMS_ADMIN_*` block
   at all before this session — added).

## Isolation from the running developer environment

`docker-compose.prod.yml` uses a different Compose project name
(`besat_site_prod` vs. the developer file's `besat_site`), different named
volumes (`*_prod` suffix), and defines no container names that collide
with the developer compose's `besat_backend`/`besat_db`/`besat_frontend`.
It also publishes different **host ports** by default — `8080`/`3080`,
not `8000`/`3000` (see "Independent review caught real gaps" below for
why this matters: project/volume-name separation alone does not prevent a
host port collision). Bringing it up does not require stopping, and does
not affect, the developer environment. This was verified this session by
running the fail-closed guard tests and isolated image build/run cycles
while the developer `besat_backend`/`besat_db` containers stayed up and
healthy throughout, unmodified.

## Independent review caught real gaps — first draft was REOPENED

An independent `codex-reviewer` review of the first version of this work
(source-review level — its environment has no Docker/Django access)
correctly found three real problems that Claude's own isolated testing had
missed, and returned a REOPENED verdict rather than accepting the initial
claims at face value:

1. **Production settings were not pinned by Compose.** The backend only
   received `DJANGO_SETTINGS_MODULE` through `backend/docker.env` (an
   editable env file) — a wrong or missing value there would silently
   fall through to `config/wsgi.py`'s own fallback
   (`config.settings.local`, `DEBUG=True` by default), completely
   bypassing the fail-closed guard, since that guard only runs when
   production settings are actually the ones imported. **Fixed**: added
   an explicit `environment: DJANGO_SETTINGS_MODULE: config.settings.
   production` directly in `docker-compose.prod.yml`'s backend service —
   Compose's own `environment:` always takes precedence over `env_file:`
   for the same key, so this can no longer be silently overridden by
   `docker.env`.
2. **The production and developer stacks collided on host ports** — both
   defaulted to `8000`/`3000`. Distinct Compose project/volume names do
   not prevent a host port collision. **Fixed**: production now defaults
   to `8080`/`3080` instead.
3. **`DATABASE_URL` was not validated** — if omitted, `config/settings/
   base.py` silently falls back to a local SQLite file inside the
   container's own ephemeral filesystem (not the mounted volume), meaning
   a production deployment could run and lose all its data on every
   restart without any error. **Fixed**: the guard now also rejects a
   resolved SQLite database engine in production.

All three were re-verified in a fresh, isolated, disposable Docker image
build/run cycle (same methodology as the first round — see
`.agents/collab/claude/FIXES.md`) before resubmitting for another
independent review round.

## Building the frontend image: required build-time arguments

**This section supersedes the old "`NEXT_PUBLIC_SITE_URL` build-time-vs-
runtime nuance" note that used to live here** (OPS-PROD-DOC-DRIFT-001):
that note described `NEXT_PUBLIC_SITE_URL` as a normal runtime value to
"revisit... if a real deploy exposes stale metadata." That's no longer
accurate. Both `NEXT_PUBLIC_SITE_URL` and `BESAT_BACKEND_API_URL` are
**webpack-inlined / serialized into the build output at `next build`
time**, not read at container start:

- `NEXT_PUBLIC_SITE_URL` feeds the root layout's `metadataBase`, used by
  every statically-prerendered page's canonical/OG metadata
  (`OPS-FRONTEND-BUILD-ORIGIN-001`).
- `BESAT_BACKEND_API_URL` feeds `next.config.ts`'s `/media/*` rewrite
  (Django serves uploaded product/gallery/news/tour files there; Next has
  no route of its own for that path) — `next start` reads the routes
  manifest `next build` already generated, it does not re-run
  `next.config.ts`'s `rewrites()` at runtime (`OPS-FRONTEND-MEDIA-
  REWRITE-001`).

`docker-compose.prod.yml`'s `frontend.env_file` (`frontend/.env.
production`) only applies once the container is already running, at
`docker compose up` — long after the image already exists. It **cannot**
influence either of these. Export both variables in your shell (same
values as `frontend/.env.production`) before building:

```sh
export NEXT_PUBLIC_SITE_URL=https://besat.org
export BESAT_BACKEND_API_URL=http://backend:8000/api
docker compose -f docker-compose.prod.yml build frontend
```

`frontend/Dockerfile` fails the build outright, with a clear message, for
either variable:

- `BESAT_BACKEND_API_URL` missing, malformed, or resolving to
  loopback/unspecified/link-local/a raw private IP/the cloud
  metadata-service address (`frontend/scripts/validate-production-
  backend-url.mjs`) — a raw private IP is rejected because this compose
  topology's only stable way to reach the backend is its DNS service name
  (`backend`), not a raw IP that bypasses Compose's own service
  discovery.
- `NEXT_PUBLIC_SITE_URL` missing, non-`https://`, resolving to
  loopback/unspecified/link-local/a private IP, or looking like an
  unedited template placeholder (`your-domain.example`,
  `besat.example.com`, `example.com`/`.org`/`.net`/`.edu`)
  (`frontend/scripts/validate-production-site-url.mjs`).

Both share their IP-range checks via `frontend/scripts/lib/network-
address-checks.mjs` rather than duplicating loopback/private/link-local
logic in two places.

## Known limitations / explicitly not solved this session

- **The build-time validators check shape, not reachability.** Neither
  `validate-production-backend-url.mjs` nor `validate-production-site-
  url.mjs` can confirm the URL is actually correct (e.g. a genuinely
  public but *wrong* domain, or a backend service name that doesn't
  exist in this compose file, would both still pass) — they only catch
  the "obviously can't be right" shapes (unset, malformed, loopback,
  private, placeholder). A release smoke test that scans the built
  static HTML for unexpected hosts, plus an actual `/media/<known-file>`
  and canonical-URL check against a real running deployment, remains the
  stronger check and is not automated here.
- **No reverse proxy / TLS termination is defined in this repository.**
  `docker-compose.prod.yml` publishes the backend and frontend ports
  directly; a real deployment needs a reverse proxy (nginx, Caddy, a cloud
  load balancer, ...) in front handling TLS and setting
  `X-Forwarded-Proto` correctly, with `TRUST_PROXY_HEADERS=true` only set
  once that's confirmed working (see `backend/docker.env.example`'s
  `SECURE_SSL_REDIRECT`/`SECURE_HSTS_*` defaults, deliberately left *off*
  in the template to avoid an operator hitting a redirect loop before the
  proxy is correctly configured — turn them on once it is).
- **Public topology** (`besat.org`, `www.besat.org`, `api.besat.org`,
  future `ops.besat.org`/`status.besat.org`) is conceptual/expected, not
  provisioned by anything in this repository — no DNS, certificates, or
  reverse-proxy config exist here. `ops.besat.org`/`status.besat.org` are
  intentionally not referenced anywhere in `ALLOWED_HOSTS`/CORS defaults
  since those services don't exist yet.
- **This has not been deployed to a real production host.** Everything
  above was validated in isolated, disposable contexts (unit tests,
  subprocess tests, one fresh throwaway Docker image build/run, all
  cleaned up afterward) — a real first deployment should still be treated
  as the actual first real-world test of this path.
