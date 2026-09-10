# Besat — Threat Model

## Assets (ranked by sensitivity)

| Asset | Sensitivity | Where it lives today |
|---|---|---|
| Student/parent personal information (names, phone, address, guardianship links) | **Critical** | Postgres, via `apps.accounts`, `apps.registration`, parent↔child linkage in `UserUnitMembership`/related models |
| Account credentials (password hashes, JWT signing key, refresh tokens) | **Critical** | Postgres (hashes) + `SECRET_KEY` env var (signing) |
| Orders/payment records | **High today, will become Critical** the day a real payment gateway replaces the current `mock` provider | Postgres, `apps.shop` |
| Staff/technician accounts and future Ops Portal credentials | **Critical** (extraordinary privilege by design) | Does not exist yet — see SPOF_AUDIT.md |
| CMS content (news, achievements, gallery, editorial workflow state) | **Medium** — public-facing once published, but pre-publication drafts and internal workflow state (who wrote what, revision history) are not meant to be public | Postgres, `apps.content` and related apps |
| Uploaded media (photos of real students, virtual-tour panoramas) | **High** — photos of minors are sensitive regardless of whether the platform treats them as such | Local disk (`MEDIA_ROOT`), no encryption at rest, no access control beyond Django's serving path |
| Configuration/secrets (`SECRET_KEY`, DB password, future SMTP/payment credentials) | **Critical** | Environment variables, `docker.env` (gitignored, currently placeholder-only — verified) |
| Application/security logs | **Medium** — valuable to an attacker for reconnaissance, and integrity-critical for incident response | Currently: unstructured console output only, no centralized store |
| Backups | **Critical** (once they exist) — a backup is a second copy of every other Critical asset above, at rest, potentially for longer | Do not exist yet |

## Trust boundaries

```
[ Browser ] ──HTTPS (target)/HTTP (dev)──▶ [ Next.js frontend ]
                                                   │  BFF proxy (same process)
                                                   ▼
                                          [ Django backend / DRF API ]
                                                   │
                                   ┌───────────────┼───────────────┐
                                   ▼               ▼               ▼
                            [ PostgreSQL ]  [ Local disk media ]  [ future: payment/
                                                                    email/SMS providers ]

                     (not yet built, separate trust boundary by design)
[ Browser ] ──HTTPS──▶ [ Ops Portal — independent auth, independent session store ]
                                                   │
                                                   ▼
                                    [ Telemetry store — must be independent
                                      of the monitored app's own health ]
```

Boundary crossings that matter most for this threat model:

1. **Browser → Next.js**: the only boundary today with zero reverse proxy/WAF
   in front of it. All input validation for anything the frontend forwards
   verbatim happens either in the frontend (untrustworthy — client can be
   bypassed) or must happen again at the Django boundary (trustworthy, and
   confirmed as the actual authoritative layer per the DRF serializer/
   validator pattern already in use throughout `apps/*`).
2. **Next.js BFF proxy → Django**: an internal, same-Docker-network hop.
   `TRUST_PROXY_HEADERS` gates whether Django trusts `X-Forwarded-*` from
   this hop — correctly opt-in, correctly documented in-line as to why (see
   ARCHITECTURE.md §5).
3. **Django → PostgreSQL**: internal only, DB not exposed to the host network
   (verified in `docker-compose.yml` — no `ports:` mapping on `db`).
4. **Django → local disk (media)**: not a network boundary, but a trust
   boundary in the sense that anything written here becomes directly
   web-servable; upload validators (`apps/*/validators.py`) are the actual
   enforcement point — see ATTACK_SURFACE.md for the per-app inventory.
5. **Future: Ops Portal ↔ everything else**: by explicit design requirement,
   this must be a *separate* trust boundary from the main app, with its own
   session/credential store, so that a compromise of one does not
   automatically grant the other.

## Roles (real, as modeled in code — `apps/accounts/models.py`)

| Role | Scope | Where defined |
|---|---|---|
| `general_manager` | Whole-platform, cross-unit | `UserProfile.Role.GENERAL_MANAGER` |
| `unit_manager` | Scoped to specific unit(s) via `UserUnitMembership` | `UserProfile.Role.UNIT_MANAGER` / `UserUnitMembership.UnitRole.UNIT_MANAGER` |
| `unit_media` | Scoped to specific unit(s) via `UserUnitMembership` (this is the role the frontend UI calls "Media Manager") | `UserProfile.Role.UNIT_MEDIA` |
| `parent` | Scoped to their own linked children only | `UserProfile.Role.PARENT`, default role |
| *(Django built-in superuser/staff, `/admin/`)* | Whole-platform, separate from the above four | `django.contrib.auth`, gated by `ADMIN_URL` |
| *(planned, not yet built)* `SENIOR_TECHNICIAN` / `TECHNICIAN` / `READ_ONLY_TECHNICIAN` | Ops Portal only, deliberately isolated from the four product roles above | Not yet implemented |

Note the correction from this session's earlier framing: "Media Manager" in
product language corresponds to the `unit_media` role in code, and there is
a *separate*, previously-under-documented `unit_manager` role with its own
panel (`/unit-manager/*` routes, redirecting into the shared
`content-manager` dashboard surface) — both are unit-scoped, distinct from
each other and from `general_manager`. Any authorization matrix must treat
these as four (soon six, once Ops exists) genuinely distinct roles, not
three.

## Attackers (per the governing brief, mapped to what's real here)

| Attacker | Realistic capability against Besat today |
|---|---|
| Anonymous attacker | Full access to every public route; can attempt registration, contact form, login brute-force, and any endpoint not gated by `IsAuthenticated` (the DRF default permission class — see ARCHITECTURE.md — meaning *unauthenticated access is opt-in per-view*, a fail-closed default worth noting as a positive). Can attempt injection/XSS against any public input field (search, contact form, registration form). |
| Compromised student/parent account | Whatever a `parent` role can do — see own children's data, submit forms, use shop. The authorization matrix (ASVS_MATRIX.md, and real IDOR testing — see SECURITY_TEST_REPORT.md) is what determines whether this attacker can reach *other* parents' or students' data. |
| Malicious authenticated user (any of the 4 roles) | Same as above, scoped to that role's intended privilege — the entire point of the authorization matrix is proving they cannot exceed it. |
| Compromised staff account (`unit_manager`/`unit_media`/`general_manager`) | Highest-value target among the four product roles — CMS write access, potentially cross-unit data depending on how well unit-scoping is enforced (a specific, testable IDOR class — see SECURITY_TEST_REPORT.md). |
| Compromised technician (Ops Portal) | **Does not exist yet as an attack surface** — but must be designed against from day one per the brief's explicit requirement, since a technician has "extraordinary privilege" by construction. The Ops Portal's own security review (once built) is a separate, dedicated document. |
| Bot / automated abuse | Registration spam, contact-form spam, login credential stuffing, scraping. Current defense: DRF scoped throttles — real but weakened by the per-worker cache gap (see FAILURE_MATRIX.md); no CAPTCHA, no bot-detection layer found in the codebase. |
| Compromised dependency | See DEPENDENCY_SECURITY.md — real scan run, one real finding fixed (Pillow), remaining findings classified as non-exploitable in this runtime. |

## Abuse cases (concrete, mapped to real endpoints — starting list, expanded in SECURITY_TEST_REPORT.md as each is actually tested)

1. A `parent` account attempts to fetch another parent's child's data by
   guessing/incrementing an ID in a URL (classic IDOR) — e.g. against
   whatever endpoint backs the Parent panel's "children" view
   (`apps/dashboard/panel_views.py: ParentChildrenAPIView`,
   `ParentChildDetailAPIView`).
2. A `unit_media` account for Unit A attempts to read or write gallery/news
   content scoped to Unit B.
3. A `unit_manager` account attempts an action reserved for
   `general_manager` (e.g. creating another user, changing a unit's own
   configuration) by calling the API directly rather than through UI, which
   only hides — not gates — such actions.
4. An anonymous or low-privilege user attempts to read `is_internal`,
   role, or ownership fields on a writable serializer to see whether they
   are mass-assignable (over-posting / mass-assignment class, ASVS V4/V13).
5. A registration or contact-form submission is replayed or resubmitted
   rapidly to test whether the per-endpoint throttle actually holds under
   the known per-worker-cache weakness (FAILURE_MATRIX.md).
6. An uploaded "image" file (gallery/product/avatar/panorama) is actually a
   disguised script, an SVG with embedded JS, or a decompression bomb —
   tests the validators in `apps/*/validators.py` directly, not just
   Pillow's own patched CVEs.
7. Once a real payment provider exists: a checkout request is replayed to
   attempt a double-charge, or a payment callback is spoofed without a
   verifiable signature — must be designed against *before* a real gateway
   ships, per FAILURE_MATRIX.md's payment-workflow entry.

Each of these is either tested live and reported in `SECURITY_TEST_REPORT.md`
with a verdict, or explicitly marked untested there — this document lists
what *should* be tested; it does not itself constitute test evidence.
