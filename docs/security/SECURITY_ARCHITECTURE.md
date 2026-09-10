# Security Architecture

This document covers the security-specific architecture decisions not
already detailed in `docs/reliability/ARCHITECTURE.md` (which covers the
full system architecture, including the security controls already
verified in place — §5 of that document). Read that one first; this one
adds what's specifically security-scoped: defense-in-depth layering, the
crypto/secrets approach, and the CSP/browser-security design that was not
yet implemented as of this session's start.

## Defense-in-depth layers (as they exist today)

```
1. Network        → NONE YET (no reverse proxy/WAF; direct port exposure
                     in local dev is fine, would be a real gap if lifted
                     as-is to a real host — see ARCHITECTURE.md §6)
2. Transport       → SECURE_SSL_REDIRECT + HSTS in production.py (real,
                     verified) -- but TLS termination itself has nowhere
                     to happen yet (no reverse proxy)
3. Application     → CORS allow-list, CSRF protection, DRF fail-closed
                     IsAuthenticated default, per-view/per-object
                     role-based permission classes (real, tested this
                     session for the parent role -- see
                     SECURITY_TEST_REPORT.md)
4. Input           → DRF serializers as the authoritative validation
                     layer (frontend validation exists too, but is
                     explicitly untrusted -- correct architecture);
                     nh3 for HTML sanitization of CMS rich content
5. Data            → PostgreSQL access restricted to the Docker network
                     (not exposed to host); no encryption-at-rest yet
                     (see DATA_CLASSIFICATION.md)
6. Secrets         → Environment variables via django-environ;
                     `SECRET_KEY` fails closed with no production
                     default (verified); docker.env correctly gitignored
                     with only placeholder values (verified, this
                     session)
7. Browser         → X-Frame-Options: DENY, X-Content-Type-Options:
                     nosniff (both verified present) -- CSP, Referrer-
                     Policy, and Permissions-Policy were NOT present as
                     of this session's start; see below for what changed
```

## CSP and browser security headers

**Before this session: no `Content-Security-Policy` header anywhere**
(backend or frontend), no `Referrer-Policy`, no `Permissions-Policy`.
`X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` were already
present (Django's `SecurityMiddleware` defaults, explicitly confirmed in
`config/settings/base.py`/`production.py`).

Implementation approach chosen, per the governing brief's explicit
constraint ("Implement CSP in a way compatible with the chosen stable Next
architecture. Do not blindly introduce nonce/dynamic-rendering behavior
without testing production build and performance"): CSP was **not
implemented this session** — at the time this section was first written,
the Phase 0 build investigation was still in progress and `next build`'s
trustworthiness was genuinely unverified, so adding a nonce-based CSP
(which requires per-request dynamic rendering to inject a fresh nonce into
every page) would have added a *second* untested dynamic-rendering
dependency on top of an unverified build pipeline, making it impossible to
tell which of the two was responsible for any new build failure.

**Phase 0 is now resolved** (`docs/reliability/PHASE0_BUILD_BLOCKER.md` —
the real production Docker image builds cleanly, true exit code 0,
verified this session) — the original blocking reason no longer applies.
CSP implementation is now unblocked and is the correct next step in the
browser-security layer, **not done in this session purely due to time,
not because it remains blocked**. When implemented, include a real
production-build test (`docker build -f frontend/Dockerfile`) as part of
the same change, to catch any interaction between the two rather than
assuming compatibility.

What *was* verified/hardened this session in the browser-security layer
(independent of CSP, and independent of the build defect):

- `frontend/src/app/global-error.tsx` added — see
  `PHASE0_BUILD_BLOCKER.md` for why, but it is also a real security-
  adjacent improvement: it replaces Next.js's bare internal default error
  page (which could leak framework version/stack details depending on
  environment) with a controlled, no-detail, on-brand fallback for any
  genuine runtime error.

## Secrets management

**Current approach**: plain environment variables via `django-environ`,
read from `.env` (dev) or the container's environment (compose). No
secret-manager integration (Vault, AWS Secrets Manager, Doppler, etc.)
exists yet — appropriate for the current all-local-dev stage, **not**
appropriate once real production secrets (a real payment provider's API
key, real SMTP credentials, a real `SECRET_KEY`) exist and need rotation
without a redeploy, or need to be kept out of any container's plain
environment listing (`docker inspect` on a misconfigured host can leak
plain env vars). Recommend: introduce a real secret-manager integration as
part of the same infrastructure work that stands up the target production
topology in `ARCHITECTURE.md` §6 — not before it's needed, but flagged now
so it's designed alongside the reverse proxy/Redis/object-storage work
rather than retrofitted.

**Verified this session**: no real secret was found leaked in the tracked
working tree (`DEPENDENCY_SECURITY.md` — gitleaks scan). The one
credential-shaped finding was unrelated third-party content, removed.

## Cryptography

No custom cryptography exists in this codebase (verified by the absence of
any hand-rolled hashing/encryption code in the apps this session touched)
— password hashing uses Django's framework-provided hashers (PBKDF2 by
default; `MD5PasswordHasher` only in `config/settings/test.py`, correctly
scoped to test-speed only, never production), and JWT signing uses
`djangorestframework-simplejwt`'s standard implementation against
`SECRET_KEY`. This is the correct posture per ASVS's "do not invent custom
cryptography" requirement — nothing to change here, only to keep true as
the system grows (any future feature needing encryption — e.g. at-rest
encryption for Critical-classified data — should use a maintained library,
not new hand-written crypto).

## What's deliberately not designed yet

- **Ops Portal's own security architecture** — it is a separate trust
  boundary by explicit requirement (`THREAT_MODEL.md`) and does not exist
  yet; its authentication/MFA/session design belongs in its own document
  once building begins, not retrofitted into this one.
- **Production network segmentation** (WAF, private subnets for
  DB/cache, bastion access) — belongs to the target topology in
  `ARCHITECTURE.md` §6, not yet built.
