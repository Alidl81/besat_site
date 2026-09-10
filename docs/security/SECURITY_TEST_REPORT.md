# Security Test Report

Real testing performed this session, with verdicts. This is evidence, not a
scan-and-forget dump — each entry below was either executed against the
live dev stack or added as a permanent, passing regression test in the
Django test suite (isolated test database, zero risk to real data).

## Summary

| # | Class | Target | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Dependency CVE (image parsing) | Pillow 11.3.0 (backend) | **CONFIRMED, FIXED** | `pip-audit` before/after; 18 CVEs → 0 |
| 2 | Dependency CVE (build tooling) | brace-expansion/js-yaml/postcss (frontend) | **NOT EXPLOITABLE IN CONTEXT** | Dependency-path analysis; all three are dev/build-time-only, unreachable from any request an end user can send |
| 3 | Secret exposure (public static assets + git history) | "Digimark" template folder, committed twice under two paths | **CONFIRMED COMPROMISED, disposition complete — see detail** | Full compromise assessment: token decoded (redacted), traced across 2 commits and 3 public remote branches, confirmed already-expired, confirmed no companion refresh token, full-history `gitleaks` scan run to confirm no further exposure. Working-tree files removed (43 in the live path); history purge explicitly evaluated and deferred pending an owner decision — see `DEPENDENCY_SECURITY.md` |
| 4 | IDOR / BOLA (parent → parent) | `GET /api/parents/children/<pk>/` | **NOT VULNERABLE — proven** | New passing regression test simulating the exact attack (parent B requests parent A's child by ID) |
| 5 | IDOR / BOLA (parent list leak) | `GET /api/parents/children/` | **NOT VULNERABLE — proven** | Same test file, second scenario (list-endpoint leak, not just detail-endpoint) |
| 6 | Missing authentication | `GET /api/parents/children/<pk>/` unauthenticated | **NOT VULNERABLE — proven** | Same test file, baseline check |
| 7 | Cross-unit IDOR (unit_media) | Gallery item creation for another unit | **NOT VULNERABLE — pre-existing coverage confirmed** | `apps/gallery/tests.py::test_unit_media_cannot_create_gallery_item_for_other_unit` (pre-existing, re-run, still passes) |
| 8 | Cross-unit IDOR (unit_manager) | Dashboard access for another unit | **NOT VULNERABLE — pre-existing coverage confirmed** | `apps/dashboard/tests.py::test_unit_manager_cannot_access_other_unit_dashboard` (pre-existing, re-run, still passes) |
| 9 | Health-check false-positive | `/api/health/` during simulated DB outage | **CONFIRMED, FIXED** | New passing test: connection settings overridden to an unreachable host, endpoint asserted to return 503 |
| 10 | IDOR / BOLA (order/address ownership) | `GET /api/shop/orders/<order_number>/`, `/api/shop/addresses/<pk>/` | **NOT VULNERABLE — proven, pre-existing coverage confirmed** | `apps/shop/test_order_ownership.py` (8 tests: other-user 404-not-403 on read/modify/delete, list-leak check, anonymous rejection) — pre-existing, re-run this session, all pass |
| 11 | IDOR / BOLA (cart item mutation) | `PATCH`/`DELETE /api/shop/cart/items/<id>/`, both authenticated-user and guest-token carts | **NOT VULNERABLE — proven** | New `apps/shop/test_cart_ownership.py`, 4 tests, this session — see detail below |

## Detail — #1: Pillow CVEs

See `DEPENDENCY_SECURITY.md` for the full CVE list. Verified fix by
re-running `pip-audit` (0 findings) and the full backend test suite
(430/430, including every test that directly exercises `PIL.Image`) after
the upgrade. No code changes were needed in `apps/*/validators.py` — the
upgrade was a drop-in replacement for the API surface this codebase uses.

## Detail — #2: Frontend build-tooling CVEs

Traced each of the 4 `npm audit` findings to its actual dependency path
(`npm ls`). All three underlying packages (`brace-expansion`, `js-yaml`,
`postcss`) are pulled in exclusively by `eslint`, `@tailwindcss/postcss`,
and `vitest`/`vite` — none are part of the code that runs in the deployed
Next.js server process or ships to the browser. The vulnerability classes
(regex/YAML/glob DoS, sourcemap path traversal) all require the attacker to
control the *input* these tools parse; in this codebase that input is only
ever this project's own trusted source tree, never a request from an end
user. `npm audit fix` was attempted first (no `--force`) and made no
changes, confirming a real fix requires a major-version bump to the parent
tool. **Not force-upgraded** — documented as accepted risk, to be revisited
opportunistically when eslint/vitest/tailwindcss next bump these
transitively for unrelated reasons.

## Detail — #3: Digimark secret exposure — full compromise assessment

Initial handling (working-tree file deletion) was **explicitly corrected**
as insufficient — a tracked credential must be treated as potentially
compromised until proven otherwise, not considered resolved by removing
the file from disk. Full assessment performed this session, evidence in
`DEPENDENCY_SECURITY.md`'s "Incident: leaked OpenAI/ChatGPT OAuth access
token" section:

- **Recovered** the token from git's object database (still present after
  the working-tree deletion) into a local scratch file, decoded it
  (JWT header/payload are base64, not encrypted — readable without the
  signing key), then **deleted the scratch file** immediately after
  extracting only the safe, non-secret summary fields below.
- **Identified**: a genuine OpenAI/ChatGPT OAuth 2.0 access token
  (`iss: auth.openai.com`), tied to a real ChatGPT Plus account (via its
  `chatgpt_account_id`/`chatgpt_plan_type` claims) — not a Besat-issued
  credential, not a false positive.
- **Redacted fingerprint** (the only form the value appears in anywhere in
  this documentation): prefix `eyJhbGciOiJS…`, length 2113, SHA-256
  `fae6431498f028803be6930e1e56c16478c06a5f0ff1a5bc0c889ad6319d75e9`.
- **Validity**: expired 2026-07-12, over a month before this investigation
  (2026-08-19) — confirmed dead, no live authentication risk remains from
  this specific token. No companion refresh token was found in the same
  captured page.
- **History exposure, corrected from the initial (incomplete) assessment**:
  present in **two** commits (`47676d3`, 2026-07-07; `61691f4`,
  2026-08-01 — a second copy under a `work/` snapshot directory), both
  confirmed reachable from `origin/main` on the **public** GitHub
  repository `Alidl81/besat_site` (verified via the GitHub API). Continuous
  public exposure window: ~6 weeks.
- **Full-history `gitleaks` scan run** (146 commits) to confirm nothing
  else was missed — 7 findings, all already accounted for, no new secret.
- **History rewrite**: evaluated, not performed — documented as a real
  option with real consequences (force-push to 3 public branches) for an
  explicit owner decision, per the standing rule against unilateral
  destructive/irreversible actions. See `DEPENDENCY_SECURITY.md` for the
  full for/against analysis.
- **No revocation action is pending** — the token is already expired;
  there is nothing left to revoke. A precautionary account-security review
  by whoever owns the ChatGPT account is recommended but not blocking.

## Detail — #4–#6: Parent panel IDOR

New test file: `backend/apps/dashboard/test_authorization_security.py`.
Written specifically because a full-repo search found existing IDOR
coverage for the `unit_media`/`unit_manager` roles (cross-unit access) but
**none** for the parent-to-parent case — a real, previously-untested gap in
an endpoint that reads correct on inspection but had never been proven by
an actual request. All 4 tests in the new file pass:

```
test_parent_can_read_their_own_child_by_id ... ok
test_parent_cannot_read_another_parents_child_by_id ... ok
test_parent_children_list_excludes_other_parents_children ... ok
test_unauthenticated_request_is_rejected ... ok
```

Root cause of why this endpoint is safe (for the record, now backed by a
test rather than just a read): `ParentChildrenAPIView.get_queryset()` in
`apps/dashboard/panel_views.py` filters `Student.objects.filter(parent=
self.request.user)` **before** any `pk`-based lookup happens, so a
mismatched `pk` simply isn't in the resulting queryset — the object-level
check is structural (can't be forgotten per-view) rather than an
after-the-fact ownership `if` check (which is the more common place this
class of bug actually occurs).

## Detail — #7–#8: Pre-existing cross-unit coverage

Not new this session — confirmed still present and still passing as part
of the 438-test full suite re-run. Listed here because the brief explicitly
asked for cross-unit access to be tested, and it already is, by name:

- `apps/gallery/tests.py::test_unit_media_cannot_create_gallery_item_for_other_unit`
- `apps/dashboard/tests.py::test_unit_manager_cannot_access_other_unit_dashboard`

## Detail — #10: Shop order/address ownership

Not new this session, but discovered and re-verified while checking the
ASVS matrix's own shop-ownership row: a dedicated `apps/shop/
test_order_ownership.py` already covers exactly the pattern tested for the
parent panel (#4-6 above) — `OrderDetailAPIView` and `AddressDetailAPIView`
both scope their DB lookup to `user=request.user` in the same query that
resolves the object, with an explicit code comment confirming this is the
same deliberate 404-not-403 pattern. Re-ran the file: all 8 tests pass.
This session's `ASVS_MATRIX.md` initially (incorrectly) listed this as an
untested gap based on "not reviewed line-by-line" — corrected once this
file was found and actually run, per the same standard applied everywhere
else in this report: claims get corrected the moment real evidence
contradicts them, not left standing.

**Cart ownership** (`CartAPIView`/`CartItemDetailAPIView`) was the one
genuinely open piece — not covered by the order/address file above, and
cart items support a guest-token identity path in addition to
authenticated users (both `AllowAny` by design, since guest checkout is a
real product requirement). Closed this session: new
`apps/shop/test_cart_ownership.py`, 4 tests — an intruding authenticated
user cannot `PATCH`/`DELETE` another user's cart item, an unrelated guest
token cannot mutate a different guest's item, and the legitimate owner
case still works. All 4 pass. Root cause of why this was safe (confirmed,
not assumed): `cart_service.update_item_quantity`/`remove_item` resolve
`item_id` through `cart.items` (the cart's own related manager), never a
global `CartItem.objects.get(pk=item_id)` — the same structural,
can't-forget-it scoping pattern found everywhere else in this codebase's
object-level authorization.

## Detail — #9: Health-check false positive

Full write-up in `docs/reliability/FAILURE_MATRIX.md` (DATABASE section)
and `SPOF_AUDIT.md`. The fix and its test are described there in the
reliability context; listed here too because it is, structurally, a
security-relevant finding as well — a monitoring/detection control that
silently failed closed-as-open is exactly the kind of gap ASVS V16
(logging/monitoring) and the brief's "failures are detected quickly"
objective care about.

## What was not tested this session (explicit, not silently skipped)

- **Full ASVS-scale authorization matrix** — every sensitive endpoint × every
  role × every action. #4-#8 above are real, targeted probes of the
  highest-value abuse cases identified in `THREAT_MODEL.md`, not an
  exhaustive sweep. See `ASVS_MATRIX.md` for what's assessed vs. tested vs.
  outstanding.
- **SAST** (Semgrep/Bandit-style static analysis) — not run this session.
- **DAST** (OWASP ZAP or equivalent against the live dev stack) — not run
  this session.
- **Fuzzing** of parsers/validators (e.g. the upload validators in
  `apps/*/validators.py`) — not run this session; the Pillow CVE fix (#1)
  addresses known issues in the underlying image library, but the app's own
  validation logic around it has not been fuzzed.
- **Business-logic abuse cases 5-7** from `THREAT_MODEL.md` (throttle
  effective-rate under load, upload disguised-file-type attacks,
  payment-workflow abuse) — not executed this session; #5 in particular
  (throttle bypass via multi-worker LocMemCache) is flagged as a known,
  verified-by-code-reading gap in `FAILURE_MATRIX.md` but not yet exploited
  live to confirm the exact bypass magnitude.
- **Ops Portal security review** — not applicable yet; the Ops Portal does
  not exist.
- **Container/host hardening scan** (Trivy or equivalent against built
  images) — blocked on the Phase 0 build defect (scanning a broken build's
  image tests a layout that never ships); tracked as an open item in
  `DEPENDENCY_SECURITY.md`.

No Critical or High severity finding from this session's testing remains
open without a fix or an explicit, evidence-backed non-exploitability
verdict (see the summary table). The list above is coverage still to be
done, not vulnerabilities found and left unaddressed.
