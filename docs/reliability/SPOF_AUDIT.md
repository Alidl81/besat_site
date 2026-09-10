# Single Point of Failure Audit

Verdict given first, evidence and target-state fix second, for each item the
governing instructions asked to be checked explicitly.

| Component | SPOF today? | Evidence | Target fix |
|---|---|---|---|
| Application host (Docker host) | **Yes.** | Every service (`db`, `backend`, `frontend`) is defined in one `docker-compose.yml` with no host-level redundancy of any kind. | Multi-host deployment with the reverse proxy/LB in front of ≥2 app hosts; see ARCHITECTURE.md §6. |
| Docker host | **Yes.** | Same as above — this *is* "the application host" in the current topology; there's no distinction between them yet. | Same. |
| Frontend instance | **Yes.** | One `besat_frontend` container, `restart: unless-stopped` is the only resilience mechanism, no replica count, no LB in front of it. It is *also* a SPOF for backend API access, not just rendering, because the BFF proxy lives inside it (see ARCHITECTURE.md §1). | N replicas behind a load balancer, each stateless (already true — no in-process session state was found in the Next.js layer beyond the client-held JWT). |
| Backend instance | **Yes.** | One `besat_backend` container. 3 gunicorn *workers* inside it provide some intra-process resilience to a single worker crashing, but the container itself is one point of failure — if the container/host dies, all 3 workers die together. | N container replicas behind the same LB, health-checked properly (see HEALTH MODEL work, not yet built). |
| Reverse proxy | **N/A — doesn't exist.** | No nginx/Traefik/Caddy/cloud LB found anywhere in this repository. The Next.js process is the de facto (and only) entry point. | Add one — this is a prerequisite for TLS termination, WAF/rate-limiting at the edge, and multi-instance load balancing, all still to be built. |
| PostgreSQL | **Yes — the single most consequential SPOF in the system.** | One `postgres:16-alpine` container, one named volume, no replication, no standby, no automated backup found anywhere in the repository. Every other SPOF in this table is recoverable by redeploying stateless containers; **this one is not** — losing it loses data, not just availability. Connection-exhaustion risk (a symptom of this SPOF under load) was quantified and closed this session — see `POSTGRESQL_RELIABILITY.md`: real capacity math shows ~14× headroom at today's scale, and `statement_timeout`/`idle_in_transaction_session_timeout`/`lock_timeout` are now enforced (verified against a live connection). **None of that changes the SPOF verdict** — a fully-utilized-and-protected single instance is still a single instance. | Primary + standby (streaming replication) with a defined failover procedure sized to actual budget; see `BACKUP_DR.md` (backup/restore is the immediate next priority per this session's own instructions, ahead of the Ops dashboard). Do not defer this past the other SPOFs — it is the only one with an unrecoverable failure mode. |
| Redis | **N/A — doesn't exist.** | No `CACHES` setting, no `django-redis` or `redis` package anywhere. This is *itself* a finding, not a clean bill of health: its absence is why rate-limiting is only per-worker-effective (see FAILURE_MATRIX.md) and why there is no cache-based read-shielding for the database. | Introduce Redis as shared cache + future queue backend; once it exists, *it* becomes a new SPOF to design around (fallback-to-DB-on-cache-down, per Phase 5). |
| Media storage | **Yes.** | `FileSystemStorage` on local disk, same host as everything else — see ARCHITECTURE.md §3/§4. A host-disk failure loses uploaded media with no independent recovery path. | Object storage (S3-compatible), independently backed up. |
| DNS | **N/A yet / Yes once live.** | `besat.org` / `ops.besat.org` / `status.besat.org` are target domains, not yet registered/configured per the task framing. Once live, DNS becomes a SPOF unless a resilient provider + secondary DNS strategy is chosen. | Use a DNS provider with its own SLA/redundancy; monitor resolution externally (Phase 15). |
| Monitoring system | **N/A — doesn't exist yet.** | No metrics/logging/tracing stack found (Phase 11/12 sections). Its absence is a SPOF *for visibility*, not for availability — the app can be down and nothing would say so. | Independent-of-the-main-app telemetry store, per the explicit "main app may fail while telemetry/Ops remain available" requirement. |
| Telemetry storage | **N/A — doesn't exist yet.** | Same as above. | Same — and must not live only inside the monitored app's own database/host, or it fails exactly when it's needed most. |
| Ops Portal | **N/A — doesn't exist yet.** | Not built. This audit's own eventual deliverable. | Must be built as its own failure domain (separate process/container minimum) from day one — see OPS FAILURE-DOMAIN REQUIREMENT in the governing brief; do not retrofit isolation later. |
| Technician authentication | **N/A — doesn't exist yet.** | No technician roles, no MFA, no invitation flow exist in the codebase today (grepped; only the three product-facing roles — General Manager, Media Manager, Parent — plus Django's built-in `/admin/` exist). | Dedicated, MFA-mandatory, invitation-only technician identity store, isolated from the main app's `accounts` app — see SECURITY_ARCHITECTURE.md (to be authored) and the Ops sections of the brief. |
| Backup storage | **N/A — doesn't exist yet.** | The restore *mechanism* was proven this session with real timestamped evidence (`BACKUP_DR.md`); there is still no scheduled automation and no off-host storage target — a backup file living on the same host as the database it protects is not a real backup strategy. | Off-host, encrypted, retained per a defined policy — see `BACKUP_DR.md`, "What's designed but not automated." |

## Honest summary

Of the 14 items the governing brief asked to be checked, **11 are SPOFs
today, and the remaining 3 don't exist yet at all** (which is itself a
finding, not a pass). **Zero** of the 14 currently have real redundancy.
This is expected and appropriate for a system that has never been deployed
to production — the value of this audit is having an explicit, evidence-
based list to design against, not a surprising result.

**Do not claim high availability for besat.org today.** Every service
currently lives on one Docker host with no redundancy at any tier. The
target architecture in `ARCHITECTURE.md` §6 is the design to build toward;
none of it is built yet.

## Priority order for closing these (recommended, not yet executed)

1. **PostgreSQL backup automation** (Phase 9) — the only SPOF with an
   *unrecoverable* failure mode; closing this is worth more risk-reduction
   per unit of effort than any other item here.
2. ~~**Health-check correctness**~~ **Done this session.** `/api/health/`
   now runs a real DB connectivity check and returns 503 when the database
   is unreachable, split from a separate always-200 `/api/health/live/`
   (process liveness, deliberately dependency-blind to avoid restart-loop
   risk) and a new `/api/health/deep/` (per-dependency status + latency).
   Proven via a real test that simulates a DB outage — see
   FAILURE_MATRIX.md. What remains: nothing consumes this signal yet
   (no alerting exists — see item 3 below and Phase 11-13).
3. **Reverse proxy + Redis** — unlocks TLS termination, edge rate-limiting,
   correct shared rate-limit counters, and a real cache layer in one
   infrastructure addition.
4. **Ops Portal as an isolated failure domain** — required by the brief to
   be isolated from day one; sequence it after (1)-(3) so it has real
   telemetry to show once built, not an empty shell.
5. Everything else in `FAILURE_MATRIX.md`, roughly in the severity order
   already assigned there.
