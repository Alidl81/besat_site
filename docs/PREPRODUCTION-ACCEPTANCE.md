# Besat pre-production acceptance

This checklist is the handoff gate between a locally validated deployment
package and a real staging/production target. It must be run against the
actual origin and target database after the operator supplies access. Local
Compose evidence is not production verification.

## Target identity and safety

- [ ] Record environment: staging or production.
- [ ] Record deployed commit SHA and image digests.
- [ ] Record public frontend origin and backend/gateway origin.
- [ ] Record database identity without logging credentials.
- [ ] Confirm the target is not the developer database or a replica receiving
      unrelated traffic.
- [ ] Create and verify PostgreSQL and media backups before any write.

## Data dry run and guarded apply

- [ ] Run `reconcile_verified_public_data` without `--apply`.
- [ ] Review every `KEEP_CURRENT`, `FILL_MISSING`, and
      `OWNER_CONFIRMATION_REQUIRED` line against the approved source brief.
- [ ] Confirm no numeric local IDs are used to identify production fixtures.
- [ ] Apply only after backup and owner review.
- [ ] Verify one active ContactInfo, one active SiteSettings, unique public
      unit slugs, preserved valid values, and no duplicate business records.
- [ ] Verify the internal development unit is absent from public units,
      registration options, sitemap, navigation, search/indexing, and public
      APIs while remaining available to required internal memberships.
- [ ] Sweep public data for confirmed QA/fixture/placeholder content and
      retain evidence for every quarantine/removal.

## Deployment and health

- [ ] Verify `DEBUG=False`, production settings, non-placeholder secret, safe
      hosts/origins, secure cookies, and approved forwarded-header trust.
- [ ] Verify PostgreSQL persistence and private networking.
- [ ] Run one-shot migrations and static collection once.
- [ ] Verify backend `/api/health/` and `/api/health/ready/`.
- [ ] Verify frontend readiness and gateway upstream health.
- [ ] Verify restart/recreate behavior without data or media loss.

## Public-origin security and SEO

- [ ] `http://besat.org` and `http://www.besat.org` redirect permanently to
      `https://besat.org`.
- [ ] `www.besat.org` redirects to the apex canonical host.
- [ ] Certificate chain, renewal, TLS versions, HSTS, CSP, and security
      headers pass from the real origin.
- [ ] No public URL contains localhost, `127.0.0.1`, internal service names,
      or `besat-r.com` as canonical.
- [ ] Verify robots, sitemap, canonical metadata, Open Graph, and structured
      data from the deployed host.

## Business flows

- [ ] `/contact`, footer, and registration closed/help state show the exact
      approved phone, email, and address.
- [ ] Registration remains closed unless the current owner explicitly opens a
      real window; no stale legacy dates/fees/payment identifiers are present.
- [ ] Test a disposable approved account for Admin, Content/Media, Parent,
      and Unit Manager permissions; verify cross-unit denial and logout/stale
      session behavior.
- [ ] Configure and test the real payment provider in sandbox/test mode only;
      verify redirect, server callback, failure, retry, success, duplicate
      callback, tampered callback, order state, inventory, and idempotency.

## Accessibility, compatibility, and performance

- [ ] Run Axe on home, registration, contact, login, shop, product, admin,
      and a safe payment-test path.
- [ ] Verify skip link, keyboard focus, landmarks, headings, forms/errors,
      RTL layout, filters, touch targets, and mobile viewport behavior.
- [ ] Smoke-test Chromium plus Firefox or Edge.
- [ ] Test a real phone when available.
- [ ] Capture mobile/desktop LCP, CLS, INP where available, FCP, TTFB,
      transfer size, large images, and long tasks for home/news/units/shop/
      product.

## Observability and decision

- [ ] Confirm 5xx, authentication, authorization, payment, and callback
      failures are visible in operator logs/monitoring without secrets.
- [ ] Keep the previous image, database backup, and media backup through the
      rollback decision window.
- [ ] Record owner confirmations for Unit 3, Unit 4, Unit 11, working hours,
      map details, registration windows, and promotional counts.
- [ ] Mark **PRODUCTION VERIFIED** only when every required real-origin gate
      has evidence. Otherwise report **NOT READY FOR PRODUCTION**.
