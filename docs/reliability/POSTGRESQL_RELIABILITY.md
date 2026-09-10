# PostgreSQL Reliability

Grounded in real values read directly from the running `besat_db` container
this session, not assumed defaults.

## Baseline, as measured

| Setting | Value (measured) | Source |
|---|---|---|
| Version | PostgreSQL 16.15 (Alpine) | `SELECT version();` |
| `max_connections` | 100 (stock default — never tuned) | `SHOW max_connections;` |
| Current connections (idle dev) | 6 | `SELECT count(*) FROM pg_stat_activity;` |
| Database size | 15 MB | `pg_size_pretty(pg_database_size(...))` |
| `wal_level` | `replica` | `SHOW wal_level;` — already above `minimal`, meaning WAL-based replication/PITR is *possible* without a config change once a target exists |
| `max_wal_size` | 1 GB (stock default) | `SHOW max_wal_size;` |
| `statement_timeout` | **0 (unlimited) — before this session's fix** | `SHOW statement_timeout;` |
| `idle_in_transaction_session_timeout` | **0 (unlimited) — before this session's fix** | same |
| `lock_timeout` | **0 (unlimited) — before this session's fix** | same |
| Gunicorn sizing | `WEB_CONCURRENCY=3` workers × `GUNICORN_THREADS=2` = 6 concurrent request slots per backend instance | `backend/entrypoint.sh` |
| Connection pooling | **None** — `CONN_MAX_AGE` unset (Django default `0`: a fresh connection opened and closed per request, never held idle) | `config/settings/base.py` (absent before this session) |

## Fixed this session

All three server-side safety timeouts were unconfigured (defaulting to
unlimited), matching exactly the "long-running request" and "long
transaction" failure modes already documented in `FAILURE_MATRIX.md`.
Implemented via Django's `DATABASES["default"]["OPTIONS"]["options"]`
(passed through to libpq as `-c` startup parameters, PostgreSQL-only —
skipped when the `DATABASE_URL` fallback resolves to sqlite):

```python
"-c statement_timeout=30000 "                    # 30s
"-c idle_in_transaction_session_timeout=60000 "   # 60s
"-c lock_timeout=10000"                            # 10s
```

**Verified empirically, not just read from the diff** — restarted the
backend container and queried the live connection directly:

```
statement_timeout: 30s
idle_in_transaction_session_timeout: 1min
lock_timeout: 10s
```

Full backend test suite re-run after the change: 445/445 pass. Reasoning
per value:

- **`statement_timeout=30s`**: generously above any real query this app
  runs today (simple paginated list/detail queries), safely below
  `GUNICORN_TIMEOUT` (60s, `entrypoint.sh`) — a runaway query is killed by
  Postgres *before* gunicorn would otherwise kill the whole worker process
  over it, which is a cleaner failure (one query fails; the worker and its
  other in-flight state survive).
- **`idle_in_transaction_session_timeout=60s`**: a client that opens a
  transaction and then crashes, hangs, or simply forgets to commit no
  longer holds locks (and a connection slot) indefinitely.
- **`lock_timeout=10s`**: a request waiting on a row/table lock fails fast
  with a clear, catchable error instead of silently queuing behind a stuck
  transaction for up to the full `statement_timeout`.

These are DB-connection-level defaults, not per-query overrides — they
protect every code path uniformly, including ones nobody remembers to add
an explicit timeout to.

## Connection-exhaustion capacity math

The failure matrix flags DB connection exhaustion as a real risk. Here is
the actual arithmetic, using measured values, not guesses:

```
max_connections (measured)                       = 100
superuser_reserved_connections (Postgres default) =   3
────────────────────────────────────────────────────────
usable by the application                         =  97

connections per backend instance
  = WEB_CONCURRENCY × GUNICORN_THREADS (measured)
  = 3 × 2
  = 6   (peak, per instance -- CONN_MAX_AGE=0 means this
         is the worst case, not a permanently-held floor)

reserved headroom (admin psql sessions, migrations,
  health-check queries, monitoring probes once they exist)
  = 10   (chosen conservatively; not yet measured under load)

safe number of backend instances
  = floor((97 - 10) / 6)
  = floor(87 / 6)
  = 14
```

**At today's gunicorn sizing (3×2), up to ~14 backend instances could run
concurrently against this single PostgreSQL instance before connection
exhaustion becomes a real risk**, entirely without PgBouncer or any other
pooler. Today's actual deployment is 1 instance — **~7% of that safe
ceiling**, using at most 6 of 97 usable connections at absolute peak.

### When this math changes (and pooling becomes actually necessary)

- **Increasing per-instance concurrency**: e.g. bumping to 8 workers × 4
  threads = 32 connections/instance drops the safe ceiling to
  `floor((97-10)/32) ≈ 2` instances — pooling becomes necessary almost
  immediately at that sizing.
- **Horizontal scaling past ~10 instances** at the current 3×2 sizing.
- **New connection consumers appearing**: any future Celery/async worker
  pool, a separate reporting/analytics service, or routine direct `psql`
  access from multiple technicians would each subtract from the 10-
  connection reserve above, which was deliberately conservative but
  unmeasured under real concurrent admin/monitoring load.

### PgBouncer: evaluated, not added

**Verdict: not justified today, evaluate again before either scaling
trigger above is crossed.** Reasoning: PgBouncer is a genuinely useful,
production-proven tool, but it is also a new stateful service to deploy,
monitor, and keep available — itself a new potential SPOF and a new
failure mode (see `SPOF_AUDIT.md`'s own caution against adding
infrastructure "blindly"). Given the capacity math above shows ~14×
headroom at today's real scale, adding it now would be solving a problem
that doesn't exist yet at the cost of new operational surface area that
does. **Two lighter-weight paths exist before reaching for a standalone
PgBouncer deployment, and should be tried first when the trigger is
actually crossed**:

1. **Django's native psycopg3 pool support** (`DATABASES["default"]
   ["OPTIONS"]["pool"] = True`, requires adding `psycopg[pool]` to
   `requirements.txt`) — an in-process pool per Django process, zero new
   infrastructure to deploy. Confirmed available via direct Django
   documentation lookup this session (Django docs, `ref/databases`).
   Not enabled this session (no proven need yet — see capacity math), but
   documented here as the correct next step over a standalone pooler,
   should the calculation above tip the other way.
2. Only if (1) proves insufficient at real multi-instance scale — a
   proper standalone PgBouncer (or equivalent) sitting between all
   backend instances and PostgreSQL, in `transaction` pooling mode.

## Still open (not addressed this session)

- **Slow query visibility**: `pg_stat_statements` was not confirmed
  enabled; no slow-query log or metric exists yet. Belongs to the
  observability phase (structured logging + metrics), not a standalone fix.
- **Long transaction / deadlock detection surfaced to a human**: Postgres
  detects and resolves deadlocks itself (correct, safe default behavior),
  but nothing currently surfaces *that it happened* anywhere a person
  would see it. Same dependency on the observability phase.
- **DB size / WAL growth alerting**: no threshold-based alert exists yet
  (Phase 13, not built). The measured baseline above (15 MB, 1 GB
  `max_wal_size`) is the reference point for that future alert's
  thresholds.
- **Primary/standby replication**: `wal_level=replica` means the
  PostgreSQL instance is already *configured* to support it, but no
  standby exists — this remains the #1 SPOF (`SPOF_AUDIT.md`) and the
  highest-priority infrastructure gap in the whole reliability program,
  unchanged by this session's timeout/capacity work.
- **`CONN_MAX_AGE`**: deliberately left at Django's default (`0`,
  connection-per-request) rather than set to a persistent-connection
  value. At today's real scale (6 connections/instance, ~14× headroom),
  connection-per-request's small per-request setup cost is not worth
  trading for the added complexity of reasoning about permanently-held
  connections across gunicorn's sync workers — revisit alongside the
  PgBouncer/native-pool decision above, not in isolation.
