# Besat backup and restore runbook

The production database and uploaded media are separate persistent data sets.
Back up both before a release, migration, or destructive maintenance. Never
commit dumps, media archives, checksums, or secret-bearing environment files.

## PostgreSQL backup

Run on the target host from the repository checkout:

```sh
chmod +x ops/backup-postgres.sh ops/backup-media.sh
./ops/backup-postgres.sh
./ops/backup-media.sh
```

The scripts use the running Compose services, write timestamped files under
`deploy/backups/` with mode `0600`, and record SHA-256 sidecars. The database
script uses PostgreSQL custom format with ownership/ACLs excluded so it can be
restored into the provisioned role. Store a copy off-host in the approved
encrypted backup destination; the local Docker host is not a sufficient DR
target.

By default the scripts load `deploy/production.compose.env` so Compose can
resolve the required build-time interpolation values without printing them.
Override the path explicitly when operating from another checkout:
`COMPOSE_ENV_FILE=/path/to/production.compose.env ./ops/backup-postgres.sh`.

Do not delete older backups as part of a deployment. Retention, encryption,
off-host destination, and RPO/RTO are owner/operations decisions and must be
configured outside Git.

## Restore procedure

Restoration is destructive and requires an explicit confirmation variable:

```sh
CONFIRM_RESTORE=YES ./ops/restore-postgres.sh deploy/backups/besat-postgres-<timestamp>.dump
CONFIRM_RESTORE=YES ./ops/restore-media.sh deploy/backups/besat-media-<timestamp>.tar.gz
```

The database script stops application writers, verifies a checksum when a
sidecar exists, restores with `pg_restore --clean --if-exists`, and recreates
the application services. The media script stops the app, extracts into the
persistent `MEDIA_ROOT` volume, and starts the frontend again. Verify health,
contact data, representative uploaded media, login, registration state, and
shop/order records before routing traffic.

Never run `docker compose down -v` during normal operations: the `-v` flag
deletes the persistent database/static/media volumes.

## Backup verification

At minimum, verify that the dump is non-empty and checksum-valid:

```sh
sha256sum --check deploy/backups/besat-postgres-<timestamp>.dump.sha256
pg_restore --list deploy/backups/besat-postgres-<timestamp>.dump | head
```

Periodically perform a full restore drill into a disposable PostgreSQL
database and run application ORM/API checks. A successful `pg_dump` alone is
not proof that the backup can be restored.

## Deployment ordering

1. Back up PostgreSQL and media.
2. Build the exact release images.
3. Run the one-shot `migrate` service and stop on failure.
4. Run the one-shot `collectstatic` service.
5. Recreate application services and verify health.
6. Keep the previous release and backups until the rollback window closes.
