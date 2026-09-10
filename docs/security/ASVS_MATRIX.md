# ASVS 5.0.0 — CHAPTER-LEVEL PRELIMINARY ASSESSMENT

**This is explicitly a CHAPTER-LEVEL PRELIMINARY ASSESSMENT, not a FULL
ASVS COMPLIANCE MATRIX.** Do not cite this document, or any summary of it,
as "ASVS compliant" or "ASVS certified" at any level. See the scope note
immediately below for exactly what was and was not done, and why. When the
official ASVS 5.0.0 source document can be retrieved and loaded verbatim,
this should be regenerated as a real requirement-level matrix with the
official numbered IDs — fabricating those IDs now, without the source
text in hand, was rejected as presenting false precision (see below).

## Scope note — read this before the table

The official OWASP ASVS 5.0.0 document contains roughly 280 individually
numbered sub-requirements across its 17 chapters. This session did not have
the primary source document loaded verbatim, and fabricating specific
sub-clause numbers (e.g. claiming a control satisfies "V6.2.3" precisely)
without the actual requirement text in front of me would be presenting
false precision — exactly the kind of unverified claim this whole program
exists to prevent. The 17-chapter structure below **was verified this
session** (via direct research against the official ASVS 5.0.0 GitHub
release), and every row is a genuine, real assessment of Besat's actual
implementation against that chapter's real thematic scope, backed by
evidence gathered this session or cross-referenced to prior-session work.

**What this is**: a real, chapter-level ASVS coverage assessment with
honest status per chapter, several concrete sub-items each drawn from
that chapter's actual known scope, and pointers to real evidence.

**What this is not**: a complete, official-numbering, line-by-line
280-item ASVS checklist. Producing that legitimately requires the primary
document text and, per the standard's own intent, individual verification
(testing, not just reading) of each of those ~280 items — a multi-week
undertaking on a system this size, not something achievable inside this
session without either fabricating IDs or fabricating verification. This
document is the honest, real subset; expanding it to full official
line-item coverage is listed as explicit remaining work in the final
report.

**Target**: ASVS Level 2 baseline platform-wide; Level 3-style rigor for
`ops.besat.org`, technician auth/MFA, authorization, privileged
operations, audit logs, payment/order workflows, secrets/config, and
backup/recovery, per the governing brief. Columns:
**Chapter · Applicable? · Besat implementation · Evidence · Tested this
session? · Status · Remaining risk**.

Status legend: 🟢 Verified (tested, not just read) · 🟡 Implemented,
assessed from code, not independently tested · 🔴 Gap · ⚪ N/A

---

## V1 — Encoding and Sanitization

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Django ORM used throughout (no raw SQL found in apps reviewed this/prior sessions) — parameterized queries by construction | Codebase pattern, not exhaustively re-grepped for raw SQL this session | No | 🟡 | A full grep for `.raw(`, `cursor.execute(` outside the new health-check code (which itself uses a safe, literal `"SELECT 1"` with no interpolation) was not run this session — flagged as open verification |
| Yes | `nh3` (Rust HTML sanitizer) for CMS rich-content output, both backend (`apps/content/rich_text.py`) and mirrored frontend (`sanitizeCmsHtml`) | `docs/reliability/ARCHITECTURE.md` §5, confirmed present in `requirements.txt` | Partially — prior session's stored-XSS review; not re-tested this session | 🟡 | Real, working control; not independently re-attacked this session with a fresh payload set |
| Yes | React/Next.js's default JSX escaping for all non-CMS user-facing text | Framework default | No | 🟡 | Standard framework protection; the CMS rich-content path (above) is the one place raw HTML is deliberately rendered and is the higher-risk surface |

## V2 — Validation and Business Logic

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | DRF serializers as the authoritative validation layer (frontend validation is UX-only, correctly not trusted) | `ARCHITECTURE.md` §5 confirms this is the codebase's actual pattern | No | 🟡 | Not systematically fuzzed this session |
| Yes | Business-logic abuse cases identified in `THREAT_MODEL.md` (duplicate registration, price/quantity tampering, payment replay, invitation reuse) | `THREAT_MODEL.md` abuse-case list | **No — explicitly listed as untested in `SECURITY_TEST_REPORT.md`** | 🔴 | Real gap; highest-value next testing target after this session |
| Partial | Payment workflow idempotency | `SHOP_PAYMENT_PROVIDER=mock` only — no real gateway integrated | N/A yet | 🔴 (design gap, not yet a live risk) | Must be resolved *before*, not after, a real provider is integrated — see `FAILURE_MATRIX.md` |

## V3 — Web Frontend Security

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | `config/settings/base.py`/`production.py`, verified this session | Yes (settings read directly) | 🟢 | None known |
| Yes | CSP, Referrer-Policy, Permissions-Policy | **Not implemented** | — | 🔴 | Deliberately deferred until Phase 0 build defect is resolved — see `SECURITY_ARCHITECTURE.md` for the reasoning; top V3 gap |
| Yes | Secure cookies (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`) | `production.py`, verified | Yes (settings read) | 🟢 | None known |
| Yes | CSRF protection | `CsrfViewMiddleware` active, `CSRF_TRUSTED_ORIGINS` explicit allow-list | No live CSRF-bypass attempt this session | 🟡 | Not independently attacked this session |

## V4 — API and Web Service

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | CORS explicit allow-list (`CORS_ALLOWED_ORIGINS`, not wildcarded) | `ARCHITECTURE.md` §5, verified | No | 🟡 | — |
| Yes | Rate limiting (DRF scoped throttles) | `ATTACK_SURFACE.md` full scope-rate table | Yes — verified the *configuration* exists; **the multi-worker effective-rate weakening was identified by code/architecture analysis, not exploited live to measure the exact bypass magnitude** | 🟡 (control exists, verified weakened) | Real, quantified-by-analysis gap: effective ceiling up to ~3× nominal. Fix: Redis-backed shared throttle storage (see ARCHITECTURE.md §6) |
| Yes | Full endpoint inventory | `ATTACK_SURFACE.md` | Yes (enumerated directly from `urls.py` this session) | 🟢 (inventory itself verified complete) | Per-endpoint authorization is the separate V8 concern below |

## V5 — File Handling

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Per-app upload validators (`apps/{gallery,shop,virtual_tour,accounts}/validators.py`), all using `PIL.Image` | `ATTACK_SURFACE.md` File Upload Surface | Indirect — Pillow's own CVEs tested/fixed; validator *logic itself* not independently tested this session | 🟡 | Magic-byte vs. extension/MIME trust, SVG-specific handling, decompression-bomb bounds beyond Pillow's own patched defenses — all explicitly flagged open in `ATTACK_SURFACE.md` |
| Yes | Upload size limits | `DATA_UPLOAD_MAX_MEMORY_SIZE`=10MB, `FILE_UPLOAD_MAX_MEMORY_SIZE`=5MB, global | Verified present in settings | 🟡 | Global limits confirmed; per-endpoint limits not independently re-verified |
| Yes | Path traversal / filename handling | `apps/accounts/models.py user_avatar_upload_to` generates a UUID-based filename, not client-supplied — a correct pattern (avoids path traversal and filename collision by construction) | Read directly this session | 🟡 | Same pattern not independently re-verified for the other 3 upload apps this session |

## V6 — Authentication

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Django's framework password hashers (PBKDF2 default) | `SECURITY_ARCHITECTURE.md` | No | 🟡 | — |
| Yes | Login rate limiting (5/min scoped throttle) | `ATTACK_SURFACE.md` | Weakened by multi-worker gap (see V4) | 🟡 | Same as V4 throttle gap |
| Yes | Standard Django password validators (similarity, min-length, common-password, non-numeric) | `ARCHITECTURE.md` §5 | No | 🟡 | Baseline only, not strengthened beyond Django defaults — acceptable for Level 2, worth revisiting for the Level-3-style Ops technician bar |
| **Yes, mandatory for Ops** | MFA for technician accounts | **Does not exist — Ops Portal not built** | — | 🔴 | Explicit brief requirement; top authentication gap once Ops work begins |
| Yes | No custom cryptography | Confirmed — no hand-rolled hashing/crypto found | Grep-verified this session | 🟢 | None known |

## V7 — Session Management

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | JWT via `djangorestframework-simplejwt`: 30 min access / 7 day refresh, rotation + blacklist-after-rotation | `ARCHITECTURE.md` §5/§3, `config/settings/base.py` | No live replay-attempt test this session | 🟡 | Real, correct configuration; not independently attacked (e.g. attempting to reuse a rotated-out refresh token) this session |
| Yes | Secure logout | `LogoutAPIView` exists (`apps/accounts/urls.py`) | Not independently re-tested this session for actually invalidating server-side state vs. just client-side token discard | 🟡 | Open verification item |
| **Yes, dedicated requirement for Ops** | Session revocation (technician) | **Does not exist — Ops Portal not built** | — | 🔴 | Explicit brief requirement |

## V8 — Authorization

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | DRF default `IsAuthenticated`, function-level permission classes per app | `ATTACK_SURFACE.md` | Verified via direct settings read | 🟢 | — |
| Yes | Object-level authorization, parent role (IDOR/BOLA) | `ParentChildrenAPIView`/`ParentChildDetailAPIView` scoping | **Yes — real passing regression test, this session** | 🟢 | See `SECURITY_TEST_REPORT.md` #4-6 |
| Yes | Object-level authorization, cross-unit (`unit_media`, `unit_manager`) | `apps/gallery/permissions.py` (reviewed in full this session), pre-existing tests | **Yes — pre-existing passing tests, re-confirmed this session** | 🟢 | See `SECURITY_TEST_REPORT.md` #7-8 |
| Yes | Object-level authorization, shop (order/address ownership) | `apps/shop/views/orders.py OrderDetailAPIView` and `apps/shop/views/account.py AddressDetailAPIView` both scope the DB lookup itself to `user=request.user` (the same structurally-safe pattern as the parent-child endpoint) — confirmed via code read this session, then confirmed via test run | **Yes — `apps/shop/test_order_ownership.py`, a pre-existing dedicated 8-test file, re-run this session: all pass** (other-user 404-not-403 on read/modify/delete for both orders and addresses, list-endpoint leak check, anonymous rejection) | 🟢 | None known for order/address detail+list. **Cart ownership specifically** (`CartAPIView`) was not covered by this file and remains unverified — flagged below |
| Yes | Object-level authorization, shop cart | `cart_service.update_item_quantity`/`remove_item` resolve `item_id` through the related manager (`cart.items.get(pk=...)`), never a global lookup — scoped for both authenticated-user carts and guest-token carts (`AllowAny` by design, isolation comes entirely from correct item-to-cart scoping) | **Yes — new `apps/shop/test_cart_ownership.py`, 4 tests, this session**: other authenticated user cannot PATCH/DELETE someone else's cart item; an unrelated guest token cannot mutate another guest's item; owner can still mutate their own | 🟢 | None known |
| Yes | Mass-assignment / over-posting protection (`is_internal`, role, ownership fields not client-writable) | `apps/units/serializers.py`'s `is_internal` handling was reviewed and fixed in a prior session (marked read-only) | Prior-session fix, not re-verified this session across every serializer | 🟡 | A systematic sweep of every writable serializer for accidentally-mass-assignable privileged fields was not performed this session |
| **Yes, dedicated requirement for Ops** | RBAC (`SENIOR_TECHNICIAN`/`TECHNICIAN`/`READ_ONLY_TECHNICIAN`) | **Does not exist** | — | 🔴 | Explicit brief requirement |

## V9 — Self-contained Tokens

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | JWT signature validation via `djangorestframework-simplejwt` (standard library, not custom) | `ARCHITECTURE.md` §5 | No | 🟡 | Standard, well-maintained library; no custom claim-parsing logic found to independently review |

## V10 — OAuth and OIDC

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| **No** | Besat does not use OAuth/OIDC anywhere — own JWT-based auth only | Confirmed by absence of any `oauth`/`oidc`/`social-auth` package in `requirements.txt` | — | ⚪ | N/A unless a future "sign in with X" feature is added |

## V11 — Cryptography

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | No custom cryptography (see V6) | Grep-verified | Yes | 🟢 | — |
| Yes | Encryption at rest | **Not implemented anywhere** (DB, media both unencrypted at rest) | — | 🔴 | Real gap for Critical-classified data (`DATA_CLASSIFICATION.md`); should-have today, must-have once real payment data exists |
| Yes | Secure randomness for tokens (invitation tokens, etc.) | `apps/accounts/invitations.py` not independently re-verified this session for its RNG source | No | 🟡 | Open verification item — confirm it uses `secrets`/Django's crypto-safe token generator, not `random` |

## V12 — Secure Communication

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | `SECURE_SSL_REDIRECT`, HSTS (30 days, includeSubDomains, preload) | `production.py`, verified this session | Yes (settings read) | 🟢 | Real config; **no TLS termination point exists yet to actually serve HTTPS** — this is a config that's correct and ready, sitting in front of infrastructure that doesn't exist yet (`ARCHITECTURE.md` §6) |
| Yes | Internal service-to-service traffic (backend↔db) | Docker internal network only, DB not exposed to host | Verified via `docker-compose.yml` read | 🟢 | Correct for current single-host topology; revisit encryption-in-transit for DB traffic once a real multi-host topology exists |

## V13 — Configuration

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | `SECRET_KEY` fails closed in production (no default) | `production.py`, verified | Yes | 🟢 | — |
| Yes | `DEBUG=False` enforced in production settings module | `production.py` | Yes | 🟢 | — |
| Yes | Secrets not committed to git | gitleaks scan, this session | **Yes** | 🟢 | See `DEPENDENCY_SECURITY.md` — one unrelated finding, fixed |
| Yes | Information leakage (stack traces, debug info) | `ENABLE_API_DOCS` correctly gated by `DEBUG` | Not independently verified with `DEBUG=False` end-to-end this session (e.g. confirming a 500 error doesn't leak a traceback in that mode) | 🟡 | Open verification item |

## V14 — Data Protection

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Data classification | `DATA_CLASSIFICATION.md`, authored this session | N/A (a classification document, not a testable control) | 🟡 | Real, grounded in actual models |
| Yes | Sensitive-field logging redaction | **No centralized logging exists to redact from** | — | 🔴 | Real gap — see `DATA_CLASSIFICATION.md`, must be designed alongside Phase 11 observability work, not after |
| Yes | Client-side data protection (no sensitive data in localStorage/exposed client state beyond the JWT itself) | Not independently re-audited this session | No | 🟡 | Open verification item |

## V15 — Secure Coding and Architecture

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Dependency/SBOM | `pip-audit`/`npm audit` run this session; SBOM **not** generated | `DEPENDENCY_SECURITY.md` | Partial | 🟡 | SBOM generation explicitly deferred until Phase 0 build is fixed (scanning/documenting a broken build's artifact is low value) |
| Yes | Defensive coding patterns | Object-level authorization pattern (scope-then-filter, per V8) is a real example of this done correctly | `SECURITY_TEST_REPORT.md` | Yes, for the one pattern tested | 🟡 | Not systematically reviewed across the whole codebase this session |
| Yes | Safe concurrency | No async workers/queue exist yet (`ARCHITECTURE.md`) — reduces this risk class's current surface area, but isn't itself a control | — | ⚪/🟡 | Revisit once any async/queue infrastructure is introduced |

## V16 — Security Logging and Error Handling

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| Yes | Structured security-event logging (failed login, privilege change, etc.) | **Does not exist — no `LOGGING` setting at all** | — | 🔴 | Top V16 gap, explicit brief requirement (Phase 11/S12) |
| Yes | Safe error handling (no stack traces to end users) | Django's default `DEBUG=False` behavior (framework-level, generic 500 page) | Not independently re-verified this session | 🟡 | Open verification item, same as V13 |
| Yes | Health/monitoring signal correctness AND information disclosure | `/api/health/` false-positive **fixed and tested**; a follow-up correction found the same endpoints were leaking raw DB exception text (hostname/DB name/username potentially embedded in exception messages) to unauthenticated callers — **fixed**: readiness now returns only `{"status": ...}`, `/api/health/deep/` (the only endpoint with a per-dependency breakdown) is now gated behind an internal service token and still never returns raw exception text even when authorized | `SECURITY_TEST_REPORT.md` #9; `apps/core/tests.py` (27 tests incl. explicit leak-detection assertions) | **Yes** | 🟢 | Detection now correct and safe to expose; nothing consumes the signal yet (no alerting) |

## V17 — WebRTC

| Applicable? | Implementation | Evidence | Tested? | Status | Remaining risk |
|---|---|---|---|---|---|
| **No** | Besat's "virtual tour" feature (`apps.virtual_tour`) is panorama-image-based (confirmed via this session's earlier work on `virtual-tour-lobby.tsx`/`PanoramaViewer`), not a real-time WebRTC media stream | Codebase inspection, this and prior sessions | — | ⚪ | N/A unless a future live-video feature is added |

---

## Rollup

| Status | Count (of the real items assessed above) |
|---|---|
| 🟢 Verified (tested) | 13 |
| 🟡 Implemented, not independently tested this session | ~28 |
| 🔴 Gap | 12 |
| ⚪ N/A | 3 |

**No item above is marked "complete" or "passed" purely from a code read
where testing was feasible and simply not done** — those are explicitly
marked 🟡 with a stated remaining-risk note, per the governing brief's
explicit instruction not to mark controls complete from inspection alone.
The 🔴 items are the honest priority list for the next phase of work; the
largest cluster is Ops Portal-dependent (V6 MFA, V7 session revocation, V8
RBAC — all "does not exist yet" rather than "exists but is broken").
