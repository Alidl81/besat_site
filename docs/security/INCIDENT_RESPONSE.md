# Incident Response

**Honest baseline: there is currently no formal incident-response tooling
(no alerting, no on-call, no incident-tracking system, no Ops Portal).**
This document is the process to follow with today's manual capabilities,
plus the target process once the Ops Portal (OPS — INCIDENT MANAGEMENT
section of the governing brief) exists. Do not read the target process as
already implemented.

## Today's actual detection capability

The only automated failure-detection that exists right now:

- Docker's own container healthchecks (`db`: `pg_isready`; `backend`:
  `/api/health/`, now DB-aware — see `docs/reliability/FAILURE_MATRIX.md`).
  These affect `docker ps` status and `depends_on: service_healthy`
  ordering; **nothing subscribes to a healthcheck transitioning to
  unhealthy** — no alert fires, no one is paged. A human running `docker
  compose ps` is the only way this is currently observed.
- Test suite failures (430→438 backend tests, 53 frontend tests) — these
  catch regressions *before* deploy if run, but nothing runs them
  automatically today (no CI — see `ARCHITECTURE.md`).

Everything else — traffic drop, error-rate spike, slow queries, disk
filling, a certificate about to expire — is **currently invisible** until a
person notices symptoms directly (a parent complaint, a developer opening
the site, a `docker compose logs` session). This is the honest starting
point; Phases 11-13 (observability, metrics, alerting) exist specifically
to close this gap, and are not yet built.

## Manual incident process (usable today)

1. **Detect**: someone notices — site down, error reported, or a scheduled
   manual check of `docker compose ps` / `/api/health/deep/` (now
   available, returns per-dependency status+latency — see
   `FAILURE_MATRIX.md`).
2. **Triage**: run, in order —
   - `docker compose ps` (which containers are up/healthy)
   - `curl http://localhost:8000/api/health/deep/` (or the frontend's BFF
     proxy equivalent) for a DB-connectivity read
   - `docker compose logs --tail=200 backend frontend db` for recent errors
3. **Mitigate**: for the common cases documented in `FAILURE_MATRIX.md`
   (process crash, DB connectivity) — `docker compose restart <service>`
   is today's only real mitigation lever. There is no rollback tooling, no
   feature-flag kill switch, no maintenance-mode toggle yet.
4. **Communicate**: **no status page exists yet** (`status.besat.org` is a
   target, not built). Until it exists, there is no way to communicate an
   ongoing incident to users other than out-of-band (word of mouth, a
   manual social/email post) — flagged explicitly rather than glossed over.
5. **Resolve & document**: no incident-tracking system exists yet. Until
   the Ops Portal's incident management feature is built, use a plain
   written record (severity, start time, what was affected, what was done,
   root cause if known, follow-ups) — even an ad hoc one is better than
   nothing, and gives the eventual Ops Portal real historical data to
   import instead of starting from zero.

## Target process (once the Ops Portal exists — design, not built)

Matches the governing brief's OPS — INCIDENT MANAGEMENT section:
`DETECTED → ACKNOWLEDGED → INVESTIGATING → MITIGATING → MONITORING →
RESOLVED`, each transition timestamped, attributed to a technician, and
linked to the alert(s) that triggered it and the audit log of any
mitigating action taken (config change, maintenance-mode toggle, etc. —
all themselves audit-logged per the Ops Portal's own requirements).

## Specific runbooks (written now, against today's real failure modes — see FAILURE_MATRIX.md for the full list)

### Backend unresponsive / 5xx storm

1. `docker compose logs --tail=200 backend` — look for a repeating
   traceback (bad deploy/config) vs. sporadic timeouts (load/DB issue).
2. `curl http://localhost:8000/api/health/deep/` — if `database.status`
   is `"down"`, this is a DB incident, not a backend-code incident; see
   below.
3. If a repeating traceback points at a specific recent change: this
   project has no automated rollback yet — revert the offending commit and
   redeploy manually, or `docker compose restart backend` if the issue is
   transient (crashed worker, not a code defect).
4. If workers are simply saturated (6 concurrent slots, `FAILURE_MATRIX.md`
   "Worker exhaustion"): there is no autoscaling; the only lever today is
   raising `WEB_CONCURRENCY`/`GUNICORN_THREADS` env vars and restarting,
   which trades memory headroom for concurrency — do not do this blindly
   under live incident pressure without knowing the host's actual free
   memory (`docker stats`).

### Database unreachable

1. `docker compose ps db` — is the container even running?
2. `docker compose logs db` — disk full, crash, or corruption signal?
3. If disk-full: this is the single most dangerous case, since **no
   automated backup exists yet** (`docs/reliability/SPOF_AUDIT.md` — top
   priority gap). Do not run any destructive cleanup against the `db`
   container's data volume without first taking a manual `pg_dump` if the
   container can still start read-only enough to permit one. If it
   genuinely cannot start, this is exactly the "irreversible schema/data
   operation requiring explicit sign-off" class of action the governing
   brief's stop-conditions describe — do not act unilaterally.

### Suspected security incident (compromised account, active exploitation)

1. **No session-revocation-at-scale tooling exists yet** beyond
   `djangorestframework-simplejwt`'s blacklist mechanism, which is
   per-token, not "kill every session for user X" — confirm whether a
   management command for that already exists in `apps.accounts` before
   assuming it needs to be built from scratch (not verified this session).
2. Do not delete or modify the account/data involved as a first step — per
   the standing "never modify real data for testing" rule and basic
   incident hygiene, preserve state for root-cause analysis before
   remediating, unless active harm is ongoing and blocking access is the
   only way to stop it (e.g., deactivate via `is_active=False`, which is
   reversible, rather than deleting).
3. This is exactly the class of incident that needs the Ops Portal's
   audit log (who did what, when) once it exists — until then, keep a
   manual written record of every remediation action taken, by whom, and
   why.

## Incident log

### INC-2026-08-19-01 — Leaked third-party OAuth token in public git history

- **Detected**: 2026-08-19, via a `gitleaks` secrets scan run as part of
  this hardening program (not from any external report or monitoring —
  no monitoring exists yet).
- **Severity**: assessed as **Low current risk, Medium historical
  exposure**. The specific token is expired and cannot be used to
  authenticate; the exposure window (public on GitHub for ~6 weeks) and
  the PII embedded in the token's claims are the residual concern, not
  active credential misuse.
- **Affected asset**: not a Besat system or Besat-issued credential — a
  third-party (OpenAI/ChatGPT) OAuth access token that had been captured
  incidentally (a "save page as" webpage snapshot, apparently taken while
  researching template designs) and accidentally committed into this
  repository, twice, under two different paths, across two commits
  (2026-07-07 and 2026-08-01).
- **Timeline**:
  - 2026-07-02: token issued by OpenAI (per its own `iat` claim)
  - 2026-07-07: first accidental commit (`47676d3`), pushed to `origin/main`, `origin/backend/mvp-bootstrap`, `origin/CMS`
  - 2026-07-12: token expired (per its own `exp` claim) — natural expiry, unrelated to any remediation action
  - 2026-08-01: second accidental commit of a duplicate copy (`61691f4`), pushed to `origin/main`
  - 2026-08-19: detected and investigated (this session); working-tree files removed; full-history scan run to confirm no further exposure; history-rewrite option documented but not executed
- **Detection**: `gitleaks` (official Docker image), first a working-tree
  scan, then a corrected full-history scan after the initial handling was
  flagged as insufficient.
- **Technician/actor**: this session (automated), acting on an explicit
  correction from the repository owner not to consider file deletion
  sufficient for a tracked credential.
- **Mitigation taken**: working-tree files removed (staged for deletion,
  not committed); full compromise assessment completed (issuer, type,
  validity, history reach, remote-push status all determined); documented
  across `DEPENDENCY_SECURITY.md`, `SECURITY_TEST_REPORT.md`, and this
  file.
- **Mitigation explicitly not taken**: git history rewrite (force-push to
  purge the blob from 3 public branches) — evaluated, documented, deferred
  pending an explicit decision from the repository owner, since the token
  is already dead and a force-push to a public repo's history is a real,
  disruptive, hard-to-reverse action.
- **Follow-up owed to the account holder**: a precautionary review of
  OpenAI/ChatGPT account security activity for the window around
  2026-07-02–2026-07-12 — not because the specific token is still usable,
  but because a public exposure of this duration warrants a human look.
- **Root cause**: an entire third-party webpage (not just an image) was
  accidentally saved into `frontend/public/images/home-slider/` during
  design research and committed without review; a defensive Tailwind
  `@source not` CSS exclusion added in an earlier session shows this was
  *noticed* as problematic at some point but never actually removed until
  this incident's investigation forced the question. A second, independent
  copy was committed a few weeks later via what appears to be a snapshot/
  backup directory (`work/frontend-authoritative`) that was only later
  added to `.gitignore`.
- **Prevention for next time**: this class of accident (saving an entire
  webpage instead of just the intended image asset) is exactly what a
  pre-commit secrets scan would catch before it ever reaches even a local
  commit, let alone a public push — listed as a concrete recommendation in
  `DEPENDENCY_SECURITY.md`/this session's remaining-work list, not yet
  implemented.
- **Status**: **Closed** for the working-tree exposure; **Open** (owner
  decision pending) for the history-purge question; **Open** (informational,
  not blocking) for the account-holder's own precautionary review.

## What this document is not

This is not a claim that Besat has an incident-response *program* —
it is the honest current manual process plus the design for what a real
one looks like. Do not cite this document as evidence of "monitored" or
"incident-response ready" without also citing that Phases 11-13
(observability/alerting) and the Ops Portal are not yet built.
