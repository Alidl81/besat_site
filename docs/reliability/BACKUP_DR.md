# Backup & Disaster Recovery

> Current operator commands are in [`docs/BACKUP-RESTORE.md`](../BACKUP-RESTORE.md)
> and `ops/backup-postgres.sh`, `ops/restore-postgres.sh`,
> `ops/backup-media.sh`, and `ops/restore-media.sh`. This file preserves the
> historical isolated restore-drill evidence and the remaining DR design
> decisions.

**A backup that has never been restored is not proven.** This document
covers both the design for real automated backups (not yet built — see
"What's designed but not automated" below) and a real, executed
backup→destroy→restore→verify drill performed this session, with actual
evidence, against an isolated database that was never the real dev
database.

## The restore drill actually performed this session

Per the explicit instruction that a claim of "backup protected" requires
successful restore evidence, not a description of intended process, this
was executed end-to-end against a disposable, isolated database — **the
real `besat_site` dev database was never modified, dropped, or otherwise
touched** at any point in this drill (confirmed by re-querying its row
count before and after, both times `4` users, unchanged).

| Step | What was done | Evidence |
|---|---|---|
| 1. Isolate | Created a new, empty database `besat_restore_drill` in the same PostgreSQL instance — a disposable target, not the real one | `CREATE DATABASE besat_restore_drill OWNER besat_user;` |
| 2. Seed with real (non-fabricated) structure+data | `pg_dump` of the real `besat_site` (read-only against the source — dumping never modifies anything) piped into the new drill database | Row counts verified matching immediately after seeding: `auth_user` 4/4, `units_schoolunit` 13/13 |
| 3. **Backup started** | `pg_dump -Fc` (PostgreSQL custom/compressed format) of the drill database | **2026-08-19T04:09:33Z** |
| 4. **Backup completed** | — | **2026-08-19T04:09:34Z** — duration **1s**, size **321,838 bytes (~314 KB)**, zero stderr output |
| 5. **Destroy** | `DROP DATABASE besat_restore_drill;` then recreated empty — genuine destruction, not a simulation; confirmed gone via `SELECT datname FROM pg_database WHERE datname='besat_restore_drill'` returning 0 rows before recreation | Verified empty result set |
| 6. **Restore started** | `pg_restore` of the step-3 backup into the freshly-recreated empty database | **2026-08-19T04:10:03Z** |
| 7. **Restore completed** | — | **2026-08-19T04:10:05Z** — duration **2s**, zero `ERROR` lines in `pg_restore`'s stderr |
| 8. **Integrity verification** | Row counts compared between the untouched source (`besat_site`) and the restored drill database, across 5 tables spanning 5 different Django apps | `auth_user` 4=4, `units_schoolunit` 13=13, `news_news` 7=7, `accounts_userprofile` 4=4, `shop_product` 1=1 — **all matched exactly** |
| 9. **Application can read restored data** | Pointed a real Django shell (`DATABASE_URL` override, same app code, no special-casing) at the restored database and ran real ORM queries, not raw SQL | `User.objects.count()` → 4, `SchoolUnit.objects.count()` → 13, `News.objects.count()` → 7, and a real field read: `SchoolUnit.objects.first().title` → `"واحد ۱ و ۲"` — **correct Persian/RTL text, proving character-encoding integrity survived the round trip, not just row counts** |
| 10. Cleanup | Drill database dropped, all local dump files deleted | Confirmed via `git status`-equivalent local check — nothing left behind |

**Verdict: backup → restore → integrity → application-readability proven,
end to end, with timestamps and durations, against an isolated database.**
This is real evidence for a database of this current size (15 MB) and
schema; re-run this same drill periodically as the real data volume grows,
since restore duration is not assumed to scale linearly without
re-measuring.

## RPO / RTO

**Targets, not yet met by automation** (no scheduled backup job exists
yet — see below):

| | Target | Current actual capability |
|---|---|---|
| **RPO** (Recovery Point Objective — how much data could be lost) | To be set by the business once real student/order data volume and update frequency are understood — **not inferred here**, since this is exactly the kind of "genuinely new business decision" this program's own stop-conditions call out. A reasonable starting proposal: 24 hours (daily backup) until a tighter requirement is specified. | **Unbounded today** — since no scheduled backup exists, RPO is effectively "since the last time someone manually ran a dump," which is not a real answer |
| **RTO** (Recovery Time Objective — how long recovery takes) | To be confirmed once real data volume is known | **Measured this session at today's 15 MB scale: backup 1s + restore 2s = 3s total mechanical time**, plus whatever time it takes a human to notice the outage and initiate the process (currently manual, no automation — see `INCIDENT_RESPONSE.md`) |

## What's designed but not automated

- **Scheduled automated backups**: not implemented. A cron-triggered
  `pg_dump` (or, better, WAL-based continuous archiving for point-in-time
  recovery — see below) needs a target off-host destination, which doesn't
  exist yet (see "Off-host target" below).
- **Off-host storage target**: the drill above stored its backup as a
  local file on the same Docker host running PostgreSQL — acceptable for
  proving the restore mechanics work, **not acceptable as a real backup
  strategy**, since a host-level failure (the actual SPOF documented in
  `SPOF_AUDIT.md`) would take the backup down with the database it's
  supposed to protect. Needs object storage (S3-compatible), consistent
  with the same object-storage recommendation already made for media in
  `ARCHITECTURE.md` §6.
- **Encryption**: the drill's backup file was not encrypted (acceptable
  for a same-session, same-host, immediately-deleted test artifact — not
  acceptable for a real retained backup containing Critical-classified
  data per `DATA_CLASSIFICATION.md`). A real implementation should encrypt
  at the storage layer (most S3-compatible providers support this
  natively) or via `pg_dump | gpg` before upload.
- **Retention policy**: not defined — same "genuinely new business
  decision" reasoning as RPO above. Do not infer a retention period
  (e.g. for compliance/legal reasons around student data) without asking.
- **Integrity checks on stored backups**: the drill verified the *restore*
  succeeded; a real scheduled system additionally needs to verify each
  *stored* backup file isn't corrupted (e.g. a checksum recorded at backup
  time, re-verified periodically) without needing a full restore every
  time to find out.
- **WAL archiving / PITR**: `wal_level=replica` is already configured
  (verified in `POSTGRESQL_RELIABILITY.md`) — meaning continuous WAL
  archiving to enable point-in-time recovery is possible without a
  PostgreSQL config change, only an archiving target and process, neither
  of which exist yet.
- **Media backup**: uploaded media (`MEDIA_ROOT`, local disk today) has no
  backup mechanism at all — a separate gap from the database backup this
  session drilled, tracked here for visibility, not addressed this
  session.
- **Config backup**: environment/configuration (not secrets themselves —
  see `SECURITY_ARCHITECTURE.md`'s secrets-management section) has no
  versioned backup beyond what's in this git repository already.

## Ops Portal display (target, once both the Ops Portal and automated backups exist)

Per the governing brief, once real automation exists, the Ops Portal
should surface: last backup time, last *successful* backup, backup age,
backup size, last restore test date, restore test result, WAL/PITR status,
RPO status, RTO status. **None of this is fabricatable from today's
one-off manual drill** — the Ops Portal must consume real, ongoing
automation output (see `docs/runbooks/DATABASE_RESTORE.md` for the
procedure that automation should eventually run on a schedule), not a
static value copied from this document.
