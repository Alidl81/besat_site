# Besat single-site production deployment

This is the operator runbook for the Docker stack at `https://besat.org`.
It deliberately does not contain server addresses, credentials, certificates,
payment keys, or a claim that production is already deployed. The existing
architecture background and fail-closed settings rationale remain in
`docs/reliability/PRODUCTION_DEPLOYMENT.md`.

## Architecture

| Service | Responsibility | Persistence / exposure |
|---|---|---|
| `db` | PostgreSQL 16 | `postgres_data_prod`; private Compose network only |
| `migrate` | One-shot Django migrations | No listener; exits non-zero on failure |
| `collectstatic` | One-shot WhiteNoise static collection | `static_data_prod` |
| `backend` | Gunicorn Django/DRF API and media storage | loopback `127.0.0.1:8080`; `media_data_prod` and static volume |
| `frontend` | Next.js production runtime and same-origin BFF | loopback `127.0.0.1:3080` |
| host gateway | TLS, redirects, forwarded-header boundary | nginx template in `deploy/nginx/besat.org.conf.example` |

Redis, Celery, or another queue is not introduced because the current product
does not require one. Uploaded media remains on the persistent Docker volume;
moving it to object storage is a later, explicit architecture decision.

## Host sizing and resource limits

The Compose file intentionally does not impose hard CPU or memory limits:
those values depend on the provisioned VPS, traffic profile, and approved
upload workload. After a baseline window, tune Docker/host quotas,
`WEB_CONCURRENCY`, `GUNICORN_THREADS`, worker timeout, PostgreSQL disk space,
and log/backup retention together. Monitor CPU, memory, disk, container
restarts, PostgreSQL connections, and OOM events before increasing replicas;
do not add replicas without revisiting migration ownership and connection
capacity.

## First installation on a new server

Run from a clean checkout of the exact SHA recorded for this handoff. Do not
use an unrecorded `latest` checkout. Set the approved SHA through the release
record (the current prepared package SHA is reported with this handoff):

```sh
git fetch --tags origin
git checkout --detach <approved-release-sha>
git rev-parse HEAD
```

1. Install Docker Engine and the Compose v2 plugin on the server. Configure
   the firewall so only SSH and the gateway's 80/443 are public; do not open
   PostgreSQL or the loopback application ports.
2. Copy the safe examples to the gitignored production files and fill them
   through the approved secret/configuration channel. Use
   `docs/PRODUCTION-ENVIRONMENT.md`; do not invent credentials.
3. Install the gateway template, replace certificate paths after DNS/TLS are
   provisioned, and validate it with `nginx -t`. The gateway must overwrite
   `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` exactly as
   the template does before `TRUST_PROXY_HEADERS=True` is enabled.
4. Render the stack without starting it:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml config --quiet
   ```

5. Build the exact release images. Build-time origin values are required:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml build --pull
   ```

6. Start only PostgreSQL and wait for its health check:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml up -d db
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml ps
   ```

7. For a genuinely empty database, verify that it is empty before any
   bootstrap. Only after owner approval may the approved public seed run; do
   not run it against an existing database:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm --no-deps backend \
     python manage.py shell -c "from apps.units.models import SchoolUnit; from apps.news.models import News; assert not SchoolUnit.objects.exists() and not News.objects.exists()"
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm --no-deps backend \
     python manage.py seed_public_data
   ```

8. Run the one-time migration and static steps. These commands are the only
   migration/static writers in the deployment procedure:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm migrate
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm collectstatic
   ```

9. Reconcile approved business data using the dry-run-first command. On an
   existing database, review every `OWNER_CONFIRMATION_REQUIRED` line before
   the explicit `--apply` invocation; the command matches singleton contracts
   and unit slugs, never local numeric IDs, and never overwrites non-empty
   conflicting values:

   ```sh
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm --no-deps backend \
     python manage.py reconcile_verified_public_data
   docker compose --env-file deploy/production.compose.env \
     -f docker-compose.prod.yml run --rm --no-deps backend \
     python manage.py reconcile_verified_public_data --apply
   ```

10. Start the application services after the one-shot steps succeed:

    ```sh
    docker compose --env-file deploy/production.compose.env \
      -f docker-compose.prod.yml up -d --no-deps backend frontend
    docker compose --env-file deploy/production.compose.env \
      -f docker-compose.prod.yml ps
    ```

11. Verify internal readiness before switching DNS:

    ```sh
    curl --fail http://127.0.0.1:8080/api/health/
    curl --fail http://127.0.0.1:3080/
    ```

12. Complete the pre-cutover checklist in `docs/PRODUCTION-CHECKLIST.md`,
    then route `besat.org` through the gateway. Do not retire the legacy site
    until redirects, content mappings, backups, and the rollback window are
    accepted by the owner.

## Normal update

1. Record the current deployed SHA and take a PostgreSQL plus media backup.
2. Fetch and check out the exact new release SHA; verify the worktree is clean.
3. Render the production Compose file and build with `--pull`.
4. Run `ops/backup-postgres.sh` before any schema change.
5. Start the new `migrate` one-shot service and stop on any non-zero result.
6. Run the `collectstatic` one-shot service.
7. Recreate `backend` and `frontend` with `docker compose up -d --no-deps`; the old
   containers are not removed until the new health checks pass.
8. Verify `/api/health/`, the internal frontend, and the real-origin smoke
   paths before declaring the rollout complete.

Do not run migrations from multiple replicas. The Compose service is the
single migration writer; application containers have `RUN_MIGRATIONS=0`.

## Rollback

- If image build, migration, static collection, or health checks fail, keep
  the gateway on the previous release and inspect logs before retrying.
- If the new app image is incompatible but the schema is backward-compatible,
  check out the previous SHA, rebuild, and recreate only application services.
- Never assume a failed or irreversible migration can be rolled back by
  changing the image. If data/schema compatibility is broken, stop writes,
  restore the verified database backup, restore media, and then start the
  previous release.
- A payment regression, login failure, or central-contact mismatch is a
  rollback trigger even when container health is green.

## Operations

```sh
docker compose --env-file deploy/production.compose.env \
  -f docker-compose.prod.yml logs --tail=200 backend frontend
docker compose --env-file deploy/production.compose.env \
  -f docker-compose.prod.yml ps
```

Logs must be collected by the host/container platform rather than written to
unbounded files inside containers. Never log environment files, passwords,
tokens, authorization headers, or payment payload secrets.
