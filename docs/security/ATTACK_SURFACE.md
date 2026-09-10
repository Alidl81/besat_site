# Attack Surface Inventory

Enumerated from `config/urls.py` and every `apps/*/urls.py` this session —
not assumed from memory. DRF's project-wide default permission class is
`IsAuthenticated` (`config/settings/base.py` `REST_FRAMEWORK
["DEFAULT_PERMISSION_CLASSES"]`), so **every endpoint below requires
authentication unless its view explicitly opts out** (`AllowAny`) — this is
a fail-closed default worth noting as a positive baseline, verified once
more here rather than re-asserted from an earlier session.

## Entry points

| Surface | Path prefix | Notes |
|---|---|---|
| Public API | `/api/*` | The overwhelming majority of the attack surface |
| Django admin | `settings.ADMIN_URL` (env-configurable, default `admin/`) | A **second, separate privileged surface** alongside the custom CMS panels — uses Django's own built-in auth, not the app's JWT scheme. Not covered by this session's IDOR testing (which targeted the custom API); its own authorization model is Django's standard staff/superuser flags, out of scope for the role-based ASVS matrix below but still a real target. |
| API schema/docs | `/api/schema/`, `/api/docs/` | Gated by `ENABLE_API_DOCS`, correctly defaults to `DEBUG`'s value — off in production unless explicitly re-enabled. If left on in production, this is a full machine-readable map of the entire API for an attacker; verify it is actually off before release. |
| Media files (dev-only serving path) | `/media/*` via Django's `static()` helper | Only registered when `DEBUG=True` (`config/urls.py` line 48-49) — correctly excluded from the production URL table. Production media serving is a separate, currently-undesigned concern (see ARCHITECTURE.md §6, object storage). |
| BFF proxy (frontend side) | `frontend/src/app/api/backend/[...path]/route.ts` | Forwards arbitrary sub-paths to the Django API — effectively extends the same `/api/*` surface through the frontend process. Already `force-dynamic` (see `FORCE_DYNAMIC_AUDIT.md`). |

## Public (unauthenticated-reachable) endpoints — the highest-value targets for an anonymous attacker

Identified by throttle scope names (`login`, `registration`, `contact`,
`customer_registration`, `checkout`) in `config/settings/base.py`, which
only make sense on endpoints reachable without an existing session, cross-
referenced against the URL list:

| Endpoint | Purpose | Throttle scope |
|---|---|---|
| `POST /api/auth/login/` | Credential submission | `login` — 5/min |
| `POST /api/auth/register/` | Public account creation (`PublicCustomerRegisterAPIView`) | `customer_registration` — 5/hour |
| `POST /api/auth/refresh/` | JWT refresh | `refresh` — 20/min |
| `POST /api/auth/set-password/` | Password set (invitation/reset flow) | `set_password` — 10/hour |
| `POST /api/messages/` | Contact form submission | `contact` — 5/hour |
| `POST /api/registration/*` | Student pre-registration request | `registration` — 3/hour |
| `GET /api/home/`, `/api/home/slides/` | Public homepage content | unthrottled (`anon` default: 100/hour) |
| `GET /api/units/`, `/api/departments/`, `/api/news/`, `/api/gallery/`, `/api/achievements/`, `/api/about/`, `/api/contact/`, `/api/content/`, `/api/site-settings/` | Public read-only content (routers, list endpoints) | `anon` default |
| `GET /api/shop/categories/`, `/api/shop/shipping-methods/` | Public catalog metadata | `anon` default |
| `POST /api/shop/checkout/preview/` | Price/availability preview (verify whether this requires an existing cart/session — not independently re-verified this session) | not in the explicit scope list — **worth confirming it isn't accidentally unthrottled and expensive** |
| `POST /api/shop/payments/callback/<provider>/` | Payment provider webhook | `payment_callback` — 60/hour. **This must be a signature/authenticity-verified endpoint, not just rate-limited, once a real provider replaces `mock`** — not independently re-verified this session; flag for the ASVS payment-workflow line item. |

**Every throttle rate above inherits the multi-worker LocMemCache weakness
documented in `ARCHITECTURE.md`/`FAILURE_MATRIX.md`** — treat all of these
as up to ~3× weaker than their nominal number in the current 3-gunicorn-
worker deployment until Redis-backed shared throttling exists.

## Authenticated, role-scoped surface

Every other `/api/*` endpoint requires authentication by the DRF default.
Within that, role-scoping is enforced per-view via the `apps/*/permissions.py`
functions/classes (pattern confirmed real and tested — see
`SECURITY_TEST_REPORT.md`). Notable high-privilege clusters:

- **`GET/POST /api/me/*`** — self-service account endpoints (profile,
  avatar upload, permissions, units, password change). Avatar upload
  (`MeProfileAvatarAPIView`) is a file-upload endpoint — see File Upload
  Surface below.
- **`/api/parents/*`** — parent-role-only, object-level-authorization
  tested this session (see `SECURITY_TEST_REPORT.md` #4-6).
- **`/api/cms/*`** (scattered across `dashboard`, `shop`, and other apps'
  URL files — e.g. `cms/reports/*`, `cms/services/`, `cms/shop/*`) — the
  editorial/management surface, role-gated per the permission classes
  already reviewed this session and in prior sessions (`HasGalleryCMSPermission`
  and equivalents per content type).
- **`/api/shop/orders/*`, `/api/shop/addresses/*`** — per-user commerce
  state. **IDOR-tested**: a pre-existing dedicated test file
  (`apps/shop/test_order_ownership.py`, 8 tests) confirms both are
  correctly scoped to the requesting user; re-run and confirmed passing
  this session — see `SECURITY_TEST_REPORT.md` #10.
- **`/api/shop/cart/*`** — **IDOR-tested this session**: new
  `apps/shop/test_cart_ownership.py` (4 tests) confirms cart-item mutation
  is correctly scoped for both authenticated-user and guest-token cart
  identity — see `SECURITY_TEST_REPORT.md` #11.
- **`/api/shop/payments/start/`** — initiates a payment attempt against
  the currently-`mock`-only provider abstraction.

## File upload surface

Every upload path found this session goes through a per-app
`validators.py` before touching disk:

| App | Validator file | Upload target |
|---|---|---|
| `apps.gallery` | `apps/gallery/validators.py` | Gallery images |
| `apps.shop` | `apps/shop/validators.py` | Product images |
| `apps.virtual_tour` | `apps/virtual_tour/validators.py` | Panorama images |
| `apps.accounts` | `apps/accounts/validators.py` (`validate_avatar_image_file`) | User avatars |

All four use `PIL.Image` + `UnidentifiedImageError` (confirmed via grep,
`DEPENDENCY_SECURITY.md`) — the Pillow CVE fix this session directly
hardens every one of these paths. **Not independently verified this
session** (flagged, not assumed passing): actual file-signature checking
vs. trusting the client-supplied extension/MIME, SVG-specific risk (SVGs
can embed `<script>`; if any upload path accepts SVG this needs explicit
sanitization, not just "is this a valid image" checking), decompression-
bomb bounds beyond what the now-patched Pillow itself defends against, and
upload size limits being enforced at the validator level in addition to
the global `DATA_UPLOAD_MAX_MEMORY_SIZE`/`FILE_UPLOAD_MAX_MEMORY_SIZE`
settings (confirmed present, `ARCHITECTURE.md`).

## Summary of what's confirmed vs. open

**Confirmed this session** (real evidence, not assumed): DRF's fail-closed
default permission posture; the specific list of intentionally-public
endpoints and their throttle scopes; the multi-worker throttle-weakening
gap; parent-role object-level authorization (tested); Pillow's role in
every upload path (and its CVEs, fixed).

**Open, not yet verified**: exact validator logic per upload type (magic-
byte checking, SVG handling); cart/order/address ownership-scoping tests;
payment-callback authenticity verification (moot today since the provider
is `mock`, but must be designed before a real one ships); whether
`/api/schema/`+`/api/docs/` are actually disabled in whatever the eventual
production env configuration turns out to be (verify at deploy time, not
just at the settings-default level).
