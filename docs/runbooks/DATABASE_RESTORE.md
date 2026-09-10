# Runbook: PostgreSQL Restore

This is the exact procedure verified working this session (see
`docs/reliability/BACKUP_DR.md` for the drill's timestamps/evidence).
**Read the whole runbook before running anything** — steps 1-3 are safe
and reversible; step 5 onward operates on the actual target database and
is destructive to whatever is currently in it.

## When to use this

- A real incident: the primary database is lost, corrupted, or a bad
  migration/manual action needs to be undone by restoring a known-good
  backup.
- A scheduled drill: this exact procedure should be re-run periodically
  (see `BACKUP_DR.md` — no schedule exists yet, this is itself an open
  item) against an isolated target, never the live database, to keep the
  restore capability proven rather than assumed.

## Prerequisites

- A backup file (`pg_dump -Fc` custom-format output). Until automated
  backups exist (`BACKUP_DR.md`), this means running the backup command
  below manually first.
- Access to the target PostgreSQL instance with a role that can create/drop
  databases (for a drill) or write to the target database (for a real
  restore-in-place).
- **For a real incident**: confirm which database you are restoring INTO
  before running anything. Restoring into the wrong target is exactly the
  kind of irreversible action the standing rules require extreme care
  around.

## Step 1 — Take a fresh backup first (even during an incident)

Before restoring anything, if the source database is still reachable at
all (even in a degraded state), take one more backup first. A bad restore
attempt should never be the reason a *more* recent recoverable state is
lost.

```sh
docker compose exec -T db pg_dump -U besat_user -d besat_site \
  --no-owner --no-acl -Fc > "backup-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Record: start time, end time, file size, and whether stderr was empty (any
`ERROR` line means the backup itself is suspect — do not proceed to
restore from it without investigating).

## Step 2 — Choose the restore target

**For a drill (recommended default — verified this session):**

```sh
docker compose exec -T db psql -U besat_user -d postgres \
  -c "DROP DATABASE IF EXISTS besat_restore_drill;"
docker compose exec -T db psql -U besat_user -d postgres \
  -c "CREATE DATABASE besat_restore_drill OWNER besat_user;"
```

**For a real incident** (restoring into the actual `besat_site` database
after data loss): confirm with whoever owns this decision that the
current state of `besat_site` is genuinely unrecoverable/should be
overwritten before proceeding — this is exactly the "irreversible
schema/data operation" class of action the standing rules require
explicit sign-off for, not something to automate through during a
stressful incident without a second confirmation.

## Step 3 — Restore

```sh
cat backup-<timestamp>.dump | \
  docker compose exec -T db pg_restore -U besat_user \
  -d <target-database-name> --no-owner --no-acl
```

Record start/end time. Check stderr for `ERROR` lines specifically —
`pg_restore` prints benign warnings (e.g. about roles that don't exist
when `--no-owner` is used) that are not failures; grep for `-i error`
rather than treating any stderr output as failure.

## Step 4 — Verify integrity

Compare row counts on a representative set of tables spanning multiple
Django apps (not just one) between the source and the restored database:

```sh
for table in auth_user units_schoolunit news_news accounts_userprofile shop_product; do
  docker compose exec -T db psql -U besat_user -d <source> -t \
    -c "SELECT count(*) FROM $table;"
  docker compose exec -T db psql -U besat_user -d <target> -t \
    -c "SELECT count(*) FROM $table;"
done
```

Add any tables specific to what the incident actually affected.

## Step 5 — Verify the application can actually read it

Row counts prove SQL-level integrity; they don't prove the Django app can
actually use the data (encoding issues, migration-state mismatches, etc.
can pass a row-count check and still break the app). Point a real Django
shell at the restored database and run real ORM queries:

```sh
docker compose exec -T -e DATABASE_URL="postgres://besat_user:besat_password@db:5432/<target>" \
  backend python manage.py shell -c "
from django.contrib.auth import get_user_model
from apps.units.models import SchoolUnit
User = get_user_model()
print('Users:', User.objects.count())
print('Units:', SchoolUnit.objects.count())
print('Sample:', SchoolUnit.objects.first().title if SchoolUnit.objects.exists() else None)
"
```

The last line specifically checks that non-ASCII (Persian/RTL) text
survived the round trip correctly — a real, previously-verified check
(see `BACKUP_DR.md`), not a hypothetical one.

## Step 6 — Clean up (drill only)

```sh
docker compose exec -T db psql -U besat_user -d postgres \
  -c "DROP DATABASE besat_restore_drill;"
```

Delete any local dump files used for the drill. **Never leave a database
dump file (which contains real data once run against `besat_site` rather
than a synthetic dataset) sitting on disk longer than the drill itself
requires** — it is Critical-classified data per `DATA_CLASSIFICATION.md`
the moment it contains anything beyond disposable synthetic content.

## Step 7 — Record the drill/incident

Per `docs/reliability/BACKUP_DR.md`'s evidence table format: backup
started/completed timestamps, duration, size; restore started/completed
timestamps, duration; integrity verification result (pass/fail per
table); application-readability verification result. This becomes the
Ops Portal's eventual data source for "last restore test" / "restore
result" once that integration exists — keep the record even for routine
drills, not just real incidents.

## What this runbook does not cover yet

- **Point-in-time recovery** (restoring to a specific moment via WAL
  replay, not just the latest full backup) — `wal_level=replica` is
  already configured (`POSTGRESQL_RELIABILITY.md`) but no WAL archiving
  process exists yet to actually enable this.
- **Restoring media files** — this runbook is PostgreSQL-only; uploaded
  media has no backup mechanism yet at all (`BACKUP_DR.md`).
- **Multi-instance coordination** — this runbook assumes a single backend
  instance; restoring a database out from under multiple live application
  instances needs a maintenance-mode/connection-draining step this
  document doesn't yet address, since multi-instance deployment doesn't
  exist yet either.
