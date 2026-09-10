# Dependency & Supply-Chain Security

Real scans run this session, not assumed. Tools used: `pip-audit` (installed
fresh inside the isolated `besat_backend` container), `npm audit` (run
inside `besat_frontend`), `gitleaks` (run via its own official Docker image
against the full working tree — no host installation, no global Python
touched, per the standing environment-isolation rule).

## Python dependencies (`backend/requirements.txt`)

**Before:** `pip-audit` found **25 known vulnerability records (18 unique
CVEs) in Pillow 11.3.0** — the only vulnerable package. All 18 were fixed
upstream in Pillow 12.2.0/12.3.0. `requirements.txt`'s own constraint
(`Pillow>=10.4,<12.0`) actively **blocked** ever picking up the fix via a
routine `pip install -r requirements.txt` refresh, because its upper bound
excluded the entire 12.x line.

| CVE | Class | Fixed in |
|---|---|---|
| CVE-2026-42308, -42309, -42310, -42311 | Integer overflow (font glyph advance, image position tracking) | 12.2.0 |
| CVE-2026-40192 | Decompression-bomb-style unbounded GZIP read (FITS image decoding) | 12.2.0 |
| CVE-2026-25990 | (see advisory) | 12.1.1 |
| CVE-2026-54058, -54059, -54060 | (see advisories) | 12.3.0 |
| CVE-2026-55379, -55380, -55798 | (see advisories) | 12.3.0 |
| CVE-2026-59197, -59198, -59199, -59200, -59204, -59205 | (see advisories) | 12.3.0 |

Real-world relevance for Besat: Pillow processes **every uploaded image**
(gallery, product photos, avatars, virtual-tour panoramas) via
`apps/*/validators.py` (`PIL.Image.open` + `.verify()`). Untrusted,
attacker-controlled image files are exactly the input class these CVEs are
about (malformed image data triggering memory-safety bugs during parsing).
This was a real, live gap for the file-upload attack surface, not a
theoretical one.

**Fixed this session:**
1. `requirements.txt`: `Pillow>=10.4,<12.0` → `Pillow>=12.3.0,<13.0`.
2. Installed `Pillow==12.3.0` inside the running dev container and verified
   via `pip-audit` re-run: **"No known vulnerabilities found."**
3. Full backend test suite re-run post-upgrade: **430/430 pass**, including
   the tests in `apps/{achievements,events,home,virtual_tour,accounts,
   gallery,core,staff}` that directly exercise `PIL.Image` — no API-usage
   regression found. The Dockerfile's `pip install -r requirements.txt` will
   pick up the fixed version on the next image build automatically.

No other Python package had any known vulnerability.

## Node dependencies (`frontend/package.json`)

`npm audit` found **4 findings (1 moderate, 3 high)**, all in
**transitive, build/dev-time-only dependencies**:

| Package | Severity | Pulled in by | Runtime-exposed? |
|---|---|---|---|
| `brace-expansion` (two copies, both old) | High (DoS) | `eslint` → `minimatch`; `eslint-config-next` → `typescript-eslint` → `@typescript-eslint/typescript-estree` → `minimatch` | **No** — lint tooling only, never runs against user input, never ships to the browser or the production server process |
| `js-yaml` 4.0.0–4.3.0 | High (CPU-DoS via crafted YAML) | `eslint` → `@eslint/eslintrc` | **No** — only parses this project's own trusted `.eslintrc`-equivalent config at lint time |
| `postcss` ≤8.5.22 (three separate copies) | High (path traversal via crafted sourceMappingURL) | `@tailwindcss/postcss` (Tailwind's own build pipeline), `next` (bundled internally), `vitest`→`vite` (test tooling) | **No** — all three copies process this project's own source CSS/JS at build/test time; none parse attacker-supplied sourcemaps at runtime |

**Verdict: Medium-classified-down-to-Low real-world risk, not exploitable
in this deployment's threat model.** All four packages/paths require an
attacker to control the *input* fed to the vulnerable parser (a crafted
YAML file, a crafted glob pattern, a crafted sourcemap comment). In this
codebase, the only "input" these tools ever see is the project's own
trusted, developer-authored source tree during `npm run lint` / `npm run
build` / `npm run dev` / `npm test` — none of them are reachable from a
request an end user (student, parent, attacker) can send to the deployed
site. **No Critical or High severity finding survives verification as
actually exploitable in Besat's runtime.**

`npm audit fix` (safe mode, no `--force`) was run and made no changes — the
fixes require major-version bumps to `eslint`, `vitest`, or
`@tailwindcss/postcss` themselves (upstream hasn't re-pinned their own
transitive deps yet). **Deliberately not force-upgraded**: forcing major
bumps to core lint/test/build tooling for a build-time-only, non-exploitable
finding risks destabilizing a working toolchain (confirmed working — see
`docs/reliability/PHASE0_BUILD_BLOCKER.md`) for zero real security benefit.
Tracked here for revisit whenever
`eslint`/`vitest`/`tailwindcss` next release a version that re-pins these
transitively — re-run `npm audit` after any of those three are upgraded for
unrelated reasons.

## Secrets scan (gitleaks, full working tree)

Run via `docker run --rm -v <repo>:/repo zricethezav/gitleaks:latest detect
--source /repo --no-git` (no-git mode scans the actual current working tree
content, not just commit history — catches anything present right now
regardless of when it was added). **23 raw findings**, classified:

| Finding class | Count | Verdict |
|---|---|---|
| Next.js Draft-Mode `previewModeEncryptionKey`/`previewModeSigningKey`/generic `encryptionKey` inside `.next/`, `.next-playwright-real/` | 11 | **Non-issue.** These are auto-generated, ephemeral, regenerated-every-build artifacts inside Next.js's own build output directories. Verified via `git check-ignore -v`: both `frontend/.next/` and `frontend/.next-playwright-*/` are gitignored — never committed, never leave this machine. |
| PyJWT source code containing the *type names* `Ed25519PrivateKey`/`Ed448PrivateKey`, and an unrelated `win32api.RegEnumKey` reference in `setuptools` | 3 | **False positive.** These are inside `work/backend-venv` — a local Python virtualenv. Verified via `git ls-files work/`: **zero files tracked**, and `git check-ignore -v` confirms `work/` (including `work/backend-venv`, `work/frontend-authoritative`) is fully gitignored. Not a real finding; matches identifier names, not secret material. |
| A high-entropy string (`generic-api-key` rule) inside `sdk(1).js.download`, a bundled third-party SDK file | 1 | **False positive, confirmed this session by inspecting its exact byte context.** The flagged string sits inside a minifier's string-interning table, in a literal array alongside unrelated property-name strings like `"substring"`, `"encode"`, `"buildGenerateFailMessage"` — it is an internal identifier constant, not a credential. |
| A real OAuth access token (`jwt` rule), inside `بررسی قالب HTML Digimark.html` (line 165) — an accidentally-saved third-party webpage sitting inside `frontend/public/images/home-slider/` | **1 real, confirmed-live-at-capture-time secret, 43 tracked files total in the folder** | **Real finding. See the dedicated incident write-up below and in `INCIDENT_RESPONSE.md` — this was NOT resolved by file deletion alone; a full compromise assessment was performed.** |

### Incident: leaked OpenAI/ChatGPT OAuth access token

**This is not resolved by deleting the file from the working tree.** Per
the explicit correction to this session's earlier (insufficient) handling,
a full compromise assessment was performed: the token was recovered from
git's object database (it is still present in history even after the
working-tree deletion), decoded, and its exposure across git history and
the remote was traced. **The token value itself was never printed in
full** — only redacted fingerprints appear below and in
`SECURITY_TEST_REPORT.md`/`INCIDENT_RESPONSE.md`.

| Question | Answer |
|---|---|
| Service/vendor | **OpenAI** — `iss` claim: `https://auth.openai.com`; `aud`: `https://api.openai.com/v1` |
| Real credential or false positive? | **Real.** Valid JWT structure (`RS256`, well-formed header/payload), internally consistent claims (`scp` includes `model.request`, `model.read`, `organization.read`, `organization.write`, `offline_access`, `openid`, `email`, `profile`), and embeds a `chatgpt_account_id`/`chatgpt_user_id`/`chatgpt_plan_type: "plus"` — the structure of a genuine ChatGPT Plus account's OAuth access token, not a synthetic/example value |
| Token type | OAuth 2.0 / OIDC access token (JWT, `RS256`-signed) — not a static API key (no `sk-...` string found; this is a session-derived access token) |
| Prefix (redacted) | `eyJhbGciOiJS…` (standard JWT header prefix — reveals nothing beyond "this is a JWT") |
| Length | 2113 characters |
| SHA-256 fingerprint | `fae6431498f028803be6930e1e56c16478c06a5f0ff1a5bc0c889ad6319d75e9` |
| Issued at (`iat`) | 2026-07-02T12:14:39Z |
| Expires at (`exp`) | **2026-07-12T12:14:39Z — already expired**, over a month before this incident was investigated (today: 2026-08-19) |
| Companion refresh token? | **None found.** The captured page was searched for `refreshToken`/`refresh_token` literals — zero matches. OAuth refresh tokens are commonly held in an `httpOnly` cookie, which a "save page as" browser capture does not include — consistent with only the short-lived access token having been captured |
| Appears valid/live *today*? | **No — expired.** The specific captured token cannot be used to authenticate as of this investigation. |
| Existed in previous git commits? | **Committed twice, under two different paths** — found by running a full-history scan (`gitleaks detect`, no working-tree-only flag) after this correction, which the initial investigation had not yet done: (1) `47676d3` ("update something in frontend", 2026-07-07) at `frontend/public/images/home-slider/...`, and (2) `61691f4` ("update many things of front" era commit, 2026-08-01) at a **second copy** of the same folder under `work/frontend-authoritative/public/images/home-slider/...` — apparently a snapshot/backup copy of the frontend directory that was briefly committed. `work/` is **not** tracked at the current HEAD (confirmed: `git ls-files work/` returns zero files), so it was removed from tracking at some point after 2026-08-01 — but removal from a later commit does not remove it from the commits that already contain it. |
| Ever pushed to `origin`? | **Yes, both commits — confirmed via `git merge-base --is-ancestor`.** `47676d3` is reachable from `origin/main`, `origin/backend/mvp-bootstrap`, and `origin/CMS`. `61691f4` is reachable from `origin/main` (not the other two branches). |
| Is the remote repository public? | **Yes.** Verified via the GitHub API (`api.github.com/repos/Alidl81/besat_site`): `"private": false`, `"visibility": "public"`. **This token has been reachable from GitHub's public default branch continuously from 2026-07-07 to today (2026-08-19) — roughly six weeks — via two separate commits, neither of which purges the other's blob from history.** |

**Disposition: marked compromised regardless of current expiry**, per
standing incident-handling practice (a credential exposed publicly is
treated as compromised even if it has since expired on its own — the
account owner should still know). **No active revocation action is
required or possible from here**: the token is already dead, there is no
"stop and revoke" step to perform, and I cannot access a third party's (or
even the account owner's own) OpenAI account on their behalf regardless.
**Recommended precaution for whoever owns this ChatGPT account** (the
commit author is the project's own developer, so this is very likely the
account of whoever was researching page-design references around
2026-07-07): sign in to platform.openai.com / chatgpt.com account
security settings and review the active-sessions/security-activity log
for the window around 2026-07-02 through 2026-07-12 as a precaution — not
because the specific captured token is still exploitable, but because a
public exposure of this duration warrants a human look regardless of
whether this investigation found a live path to abuse it.

### Should git history be rewritten to purge this token?

**Not done this session — documented here per the explicit instruction not
to rewrite history automatically.** Analysis:

**Arguments for purging history:**
- The token, and the PII embedded in its claims (`chatgpt_account_id`,
  `chatgpt_user_id`), remain permanently visible in public GitHub history
  even after this session's working-tree deletion, to anyone who checks
  out either `47676d3` or `61691f4`, or browses either on GitHub.
- It exists in **two** commits/paths now, not one — a partial purge (just
  one blob) would still leave it exposed via the other.

**Arguments against purging history right now:**
- The token is already expired and non-functional — purging history closes
  a *residual PII exposure*, not an *active credential risk*.
- Between the two commits, the affected set is still the same three remote
  branches as before (`main`, `backend/mvp-bootstrap`, `CMS`) — a real
  purge (`git filter-repo` or BFG Repo-Cleaner) would need to rewrite all
  three (targeting both blob paths), then **force-push** all three to
  `origin`. Force-pushing a public repository's branches is exactly the
  class of destructive, hard-to-reverse action this program's standing
  rules require stopping for — it also invalidates every existing local
  clone/fork's history alignment, and rewrites every commit SHA after
  `47676d3` on all three branches.
- A full-history scan (see below, now completed) found no *other* secret
  anywhere in this repository's history — this is confirmed, not assumed.

**Recommendation, not yet executed**: this is a **user decision**, not
something to perform unilaterally, exactly per the standing "irreversible
operations require explicit sign-off" rule. If the account owner wants the
PII fully purged from public history despite the token being dead, the
correct tool is `git filter-repo` (BFG's successor, actively maintained),
targeting the specific blob path across all three affected branches,
followed by a coordinated force-push and a note to anyone with an existing
clone. Given the low residual risk (dead token, no refresh token found),
this is reasonably deferrable rather than urgent — flagged for an explicit
go/no-go decision, not queued as an automatic next step.

### Follow-up: full-history scan — done

A full-history `gitleaks detect` run (146 commits, ~110MB scanned, `--redact`
to keep secret values out of even the tool's own output) was run as a
direct follow-up to the correction above. Result: **7 findings total**,
all already accounted for — the same OpenAI token (now known to exist in
two commits instead of one, corrected above), the same three PyJWT/
setuptools false positives (confirmed still only ever present inside the
gitignored, never-currently-tracked `work/backend-venv`, in the one
`61691f4` commit that briefly tracked `work/` before it was removed), and
the same SDK string-table false positive (also duplicated across the two
commits). **No secret was found in history beyond what's already
documented above.** This closes the "not verified this session" gap from
the initial handling of this incident.

## Container / base image scanning

Run this session (now that the Phase 0 build is confirmed working — see
`docs/reliability/PHASE0_BUILD_BLOCKER.md`), via the official `aquasec/
trivy` Docker image against both real, freshly-built production images
(`docker build -f frontend/Dockerfile` / `-f backend/Dockerfile`, the
exact Dockerfiles a real deployment uses).

**Note on environment**: Trivy's default vulnerability-DB mirror
(`mirror.gcr.io`) returned `403 Forbidden` in this environment — an
external network restriction, not a project issue. Worked around with
`--db-repository ghcr.io/aquasecurity/trivy-db:2`, which succeeded.

### Frontend image — 17 HIGH/CRITICAL findings, all in `node_modules`

| Package | CVE(s) | Severity | Root cause |
|---|---|---|---|
| `brace-expansion` (3 installed copies) | CVE-2026-13149, -14257, -69152 | HIGH | Transitive dep of ESLint/typescript-eslint (dev tooling) |
| `js-yaml` | CVE-2026-59869, GHSA-5p4m-2wfm-xmqj | HIGH | Transitive dep of ESLint's config loader |
| `postcss` | CVE-2026-73646 | HIGH | Transitive dep of Tailwind's build pipeline / Next's internal build tooling |
| `ip-address`, `picomatch`, `sigstore` | various | HIGH | Transitive dev-tooling dependencies |
| `tar` | CVE-2026-59873 (**CRITICAL**), CVE-2026-59874 | CRITICAL/HIGH | Transitive dev-tooling dependency |

**Root cause identified, not just each CVE individually**: the Dockerfile
ran a plain `npm ci` (installs `devDependencies` too) and never removed
them before the final image layer — every one of these 17 findings is a
package that exists in the shipped image's `node_modules` but is **never
imported or executed by `next start`** at runtime (all of them are
ESLint/build-tooling transitive dependencies, the same category already
assessed as non-exploitable for the `npm audit` findings above). Confirmed
non-exploitable by the same reasoning as the `npm audit` section: these
packages only ever process this project's own trusted source tree during
`npm run build`/`lint`, never a request from an end user, and post-build
they are not even reachable code paths.

**Fixed**: `frontend/Dockerfile` now runs `RUN npm prune --omit=dev`
immediately after the build step, before the final image layer —
`devDependencies` are still available *during* the build (where they're
genuinely needed: TypeScript, ESLint, Tailwind's build-time packages) but
are removed before the image that actually ships. Deliberately **not**
switched to Next.js's `output: "standalone"` multi-stage pattern (the more
thorough, standard fix) — that requires a `next.config.ts` change, and
given how fragile this exact build pipeline proved to be during the Phase
0 investigation, adding a new, untested config surface right after finally
getting a clean, verified build was judged not worth the risk without a
full separate re-verification pass. `npm prune --omit=dev` achieves the
same outcome (no devDependencies shipped) with zero Next.js configuration
change and was verified by rebuilding the real image and re-scanning
(below).

### Backend image — 28 HIGH/CRITICAL findings

**26 are Debian OS-level packages** (base image `python:3.12-slim`,
Debian 13.6) — the large majority (`bsdutils`, `libblkid1`, `mount`,
`util-linux`, etc., all `CVE-2026-53615`) already have a fix available in
a newer Debian package build; a handful (`libssl3t64`/`openssl`
`CVE-2026-14456`, `libncursesw6`/`libtinfo6` `CVE-2025-69720`, `gzip`
`CVE-2026-41992`, `libacl1` `CVE-2026-54369`) currently show **no fix
available** upstream from Debian yet — accepted as monitored risk, not
fixable from this project's own files. **4 CRITICAL findings are all in
`perl-base`** (CVE-2026-13221, -42496, -57433, -8376) — Perl is a
transitive dependency of Debian's own base package set (`sensible-utils`
and similar), not something this Django application uses, imports, or
executes; no fix available upstream at time of scan. Flagged, not
silently ignored — but genuinely not actionable from `requirements.txt`
or application code; would require a base-image change (e.g., a distro
with a smaller/different package set) to eliminate the package entirely,
which is out of scope for a same-session fix given no evidence of active
exploitability (nothing in this application invokes perl).

**2 are real, fixable Python package CVEs**:

| Package | CVE | Severity | Installed | Fixed in |
|---|---|---|---|---|
| `msgpack` | GHSA-6v7p-g79w-8964 | HIGH | 1.1.2 | 1.2.1 |
| `setuptools` | CVE-2025-47273 (path traversal) | HIGH | 70.3.0 | 78.1.1 |

Neither is a direct entry in `requirements.txt` — both are transitive
(bundled with the base Python installation / pulled in by another
package). **Fixed**: added explicit version floors
(`msgpack>=1.2.1`, `setuptools>=78.1.1`) to `requirements.txt` so a fresh
`pip install -r requirements.txt` resolves the patched versions instead of
whatever the base image happened to ship.

### Verification of both fixes — and a second round when the numbers didn't match the claim

Both images were rebuilt fresh from their real Dockerfiles after the
`requirements.txt`/Dockerfile changes above, then re-scanned with the
identical Trivy command. The first re-scan did **not** show the clean
result a first draft of this document assumed it would — caught before
publishing, not after, per the governing brief's explicit rule: *"Do NOT
report zero known dependency vulnerabilities if known advisories remain."*

**Frontend, round 1: 17 → 8, not 17 → 0.** `npm prune --omit=dev` removed
this project's own devDependencies as intended, but 8 HIGH/CRITICAL
findings remained (`tar`, `brace-expansion`, `picomatch`, `ip-address`,
`sigstore`). Traced via each finding's `PkgPath` in the raw Trivy JSON to
`/usr/local/lib/node_modules/npm/node_modules/...` — these are **npm's
own bundled dependencies**, shipped by the `node:22-alpine` base image so
that `npm ci`/`npm run build` work, not this project's dependencies at
all, and `npm prune` (a project-node_modules-only command) cannot touch
them. **Fix**: `frontend/Dockerfile` now invokes the built `next` binary
directly (`CMD ["node_modules/.bin/next", "start", ...]`) instead of
`npm run start`, and deletes npm's own install
(`/usr/local/lib/node_modules/npm`, `/usr/local/bin/npm`/`npx`/`corepack`)
in the layer after the build finishes — safe because nothing in the
final image invokes `npm` again. **Frontend, round 2: 8 → 0**, confirmed
by re-scan, plus a real container start + `curl` against `/` returning
`HTTP 200` with genuine page HTML (not just a successful `docker build`)
to prove removing npm didn't break `next start`.

**Backend: still 28 after the `requirements.txt` fix, not 28 → 26 as
first assumed.** `pip show msgpack setuptools` inside the rebuilt image
confirmed the *actual, importable* packages were correctly upgraded
(msgpack 1.2.1, setuptools 84.0.0) — but Trivy's JSON still listed
`msgpack@1.1.2` / `setuptools@70.3.0` as HIGH findings. Rather than
report the requirements.txt fix as working based on `pip show` alone (a
partial check) or accept Trivy's number at face value (no explanation for
the discrepancy), traced it to the byte level: `docker save` on the
image, located the exact layer via its `DiffID`, extracted that layer's
raw tar, and confirmed there is genuinely no `msgpack-1.1.2` or
`setuptools-70.3.0` directory anywhere in the image filesystem — the
only `msgpack`/`setuptools` dist-info present are the patched versions.
The stale version strings come from `pip`'s own internal metadata:
`/usr/local/lib/python3.12/site-packages/pip/_vendor/vendor.txt` (pip's
manifest of its own vendored copies) and `pip/_vendor/bom.cdx.json` (a
bundled CycloneDX SBOM) both declare `msgpack==1.1.2` /
`setuptools==70.3.0` as pip's *own internal* bundled/build-provenance
metadata — separate from, and untouched by, the `pip install -r
requirements.txt` that installs this project's actual dependencies.
Trivy's Python-package scanner reads this metadata and reports it exactly
as if it were an installed application dependency, which it is not: `pip
show` and the raw layer contents agree these files are never imported or
executed by anything this application runs (Django, gunicorn); they are
only consulted by `pip`'s own internal commands (`pip install`, `pip
download`), which nothing in the shipped image invokes after build time.

**Deliberately not removing pip from the backend image** the way npm was
removed from the frontend image: unlike the frontend (where `next start`
never needs `npm` again), a backend container is a more plausible target
for `docker exec`-based operational debugging (`pip list`, an ad hoc `pip
install` for a hotfix, etc.), and removing pip trades an inert,
non-exploitable finding for a real loss of a legitimate operational
capability. Documented here instead, precisely, per the brief's own
instruction that "accepted risk != no vulnerability":

```
Backend, final state: 28 HIGH/CRITICAL findings
  - 26 Debian OS-level packages (base image python:3.12-slim) -- mostly
    "fix: none available yet" upstream from Debian; 4 CRITICAL findings
    are all in perl-base, a Debian base-package transitive dependency
    this application never invokes.
  - 2 findings (msgpack@1.1.2, setuptools@70.3.0) are pip's own internal
    vendored-dependency metadata (pip/_vendor/vendor.txt,
    pip/_vendor/bom.cdx.json) -- NOT this project's actual installed
    packages (which are correctly patched: msgpack 1.2.1, setuptools
    84.0.0, verified via `pip show` AND direct layer-tar inspection).
    Never imported/executed by the running application. Accepted,
    documented, not silently dropped from the count.
```

Full backend test suite re-run after the `requirements.txt` change and
the health-endpoint fixes below: **all 472 tests pass**. Frontend image
re-verified with a real container start and a live HTTP request (not
just a successful build).

### A real regression this investigation caught live: health endpoints were being rate-limited

While rebuilding/re-verifying images, `docker compose logs backend`
showed the **live development container** repeatedly returning `429` on
`GET /api/health/` and flapping to Docker's `unhealthy` status. Root
cause: `apps/core/views.py`'s liveness/readiness/deep-health views use
`@api_view` but did not opt out of DRF's `DEFAULT_THROTTLE_CLASSES`
(`AnonRateThrottle`, 100/hour) — and the docker-compose healthcheck
alone (polling `/api/health/` every 10 seconds = 360 req/hour) was enough
anonymous traffic to exceed that limit on its own. In a real deployment,
this is a **self-inflicted-outage** pattern: an orchestrator that
kills/restarts containers on failed healthchecks would turn "the health
endpoint is protected by the same rate limit as everything else" into
actual downtime.

**Fixed**: all three views now carry `@throttle_classes([])`, exempting
them from DRF's default anonymous-rate throttling — infrastructure
polling health endpoints must never be treated as abuse. This reopens
exactly the risk the brief's Section 13 warned about ("readiness
currently performs a real `SELECT 1`... implement a safe health-check
strategy/caching interval") if left unaddressed, so `_check_database` in
the same file now also debounces the real database round trip to at most
one per 2 seconds per worker process, regardless of how many callers
(load balancer + orchestrator + external monitor, all polling
independently) ask within that window.

**Verified, not just fixed in theory**: five regression tests added to
`apps/core/tests.py` (`test_health_endpoints_are_never_rate_limited`,
`test_deep_health_check_is_never_rate_limited`,
`test_readiness_debounces_the_real_database_probe`,
`test_debounced_readiness_result_expires_after_the_cache_window`, plus
the pre-existing suite) — all passing. And confirmed against the real,
live container: restarted `besat_backend` with the fix applied, watched
Docker's own healthcheck log directly (`docker inspect --format
'{{range .State.Health.Log}}...'`), and observed five consecutive
`exit=0` results with the container status settling to `healthy`, versus
the `exit=1` failures recorded in the same log from before the fix.

## SBOM

**Not generated this session.** Noted as an open item for the same reason —
worth generating from a build that actually succeeds, not the current
broken one.
