# Besat production checklist

## Before server provisioning

- [ ] Confirm the exact release SHA and clean checkout.
- [ ] Provision a supported Docker/Compose host with firewall rules and
      enough disk for PostgreSQL, static files, media, and backups.
- [ ] Decide encrypted off-host backup destination, retention, RPO, and RTO.
- [ ] Obtain real Django, PostgreSQL, SMTP, payment, and TLS secrets through
      the approved secret channel.
- [ ] Confirm the registered real payment provider adapter exists; never use
      the mock provider in production.

## Before first traffic

- [ ] Configure `besat.org` and `www.besat.org` DNS and certificate.
- [ ] Install and validate `deploy/nginx/besat.org.conf.example`.
- [ ] Create production env files; render Compose without printing values.
- [ ] Build the exact source SHA with canonical build arguments.
- [ ] Verify database health, backup, migrations, static collection, and
      persistent volumes.
- [ ] Run the data dry run; apply only approved field-level changes.
- [ ] Verify central contact, registration state, unit publication boundary,
      media, users, and no confirmed public fixtures.

## Cutover

- [ ] Lower DNS TTL before the window.
- [ ] Verify HTTP→HTTPS and `www`→apex 301 redirects.
- [ ] Verify TLS, HSTS, CSP, cookies, forwarded headers, robots, sitemap,
      canonical metadata, Open Graph, and structured data.
- [ ] Enable only the documented legacy URL redirects; do not send every old
      URL to the homepage.
- [ ] Run public contact/footer/registration smoke, approved role smoke,
      sandbox payment smoke, and representative media checks.
- [ ] Start the monitoring window and record the rollback deadline.

## Post-cutover

- [ ] Watch 4xx/5xx, login, authorization, contact, registration, media,
      payment callback, and database health signals.
- [ ] Confirm backups are off-host and checksum-valid.
- [ ] Keep the previous image and release backup until the owner closes the
      rollback window.

## Rollback decision

Rollback is required for failed migrations, unhealthy backend/frontend,
critical authentication/authorization failure, central contact mismatch,
payment or callback regression, data loss, or broken canonical/redirect
behavior. Use the previous application image when the schema is compatible;
restore database/media backups when it is not. Never promise an automatic
database rollback for an irreversible migration.
