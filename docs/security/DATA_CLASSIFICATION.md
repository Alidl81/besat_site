# Data Classification

Grounded in the actual Django models found in `apps/accounts`,
`apps/dashboard`, `apps/registration`, `apps/shop`, `apps/content`, and
`apps/units` — not a generic template.

| Class | Definition | Examples in Besat | Handling requirement |
|---|---|---|---|
| **Critical** | Loss, leak, or corruption causes severe harm (legal, safety, or irreversible trust damage); minors' data | Student records (`apps.dashboard.models.Student`: full name, national code, unit/class, parent linkage); parent account PII; password hashes; `SECRET_KEY`/JWT signing material; future real payment credentials | Encrypted at rest once real infrastructure exists (not yet — see ARCHITECTURE.md); access logged (ASVS V16, not yet implemented — see below); never logged in plaintext (see below); backup-protected with tested restore (Phase 9, not yet built) |
| **High** | Sensitive but narrower blast radius than Critical | Order/payment records (`apps.shop`) — currently low real-world exposure since the payment provider is `mock` only, but the *data model* already holds order/address/amount data that becomes financially sensitive the moment a real gateway is wired in; uploaded media of real students (gallery photos, avatars) | Same access-control rigor as Critical; encryption-at-rest is a should-have today, becomes a must-have the day real payments ship |
| **Medium** | Internal/operational, not public, but not catastrophic if narrowly leaked | CMS draft/unpublished content and its revision history (`apps.content`); internal messages (`apps.dashboard.models.InternalMessage` if present); technician/staff account metadata (once Ops Portal exists) | Role-scoped access (already enforced per-app permission classes); no special encryption requirement beyond standard DB protection |
| **Public** | Meant to be public once published | Published news/announcements/achievements/gallery items; public unit/department listings; site settings | No confidentiality requirement; **integrity** still matters (a compromised CMS account publishing false content is a real abuse case — see THREAT_MODEL.md) |
| **Internal/system** | Not user data, but security-relevant | Application logs, audit logs (once they exist), configuration, infrastructure credentials | Never expose secret *values* anywhere (Ops Portal explicitly forbidden from showing them per the governing brief); logs must be redacted (see below) — not yet centrally implemented, currently console-only output with no redaction layer |

## Fields that must never appear in logs, error messages, or the future Ops Portal

Per the governing brief's explicit list, cross-referenced against this
codebase's actual sensitive fields:

- Password (plaintext — never stored; hash is stored, hash should also
  never be logged)
- JWT access/refresh tokens, `SECRET_KEY`
- Session/auth cookies
- Any future API key (payment provider, SMS/email provider) once
  integrated
- Invitation tokens (`apps.accounts.invitations` — confirmed this app
  exists; token handling not independently re-audited this session for
  logging leaks, flagged as an open item)
- Raw payment secrets (moot today — `mock` provider only — but the
  logging discipline must exist *before* a real one ships, not retrofitted
  after)
- Student national codes, full addresses, phone numbers — not secrets in
  the credential sense, but Critical-classified PII that has no business
  appearing in a stack trace or a debug log line

**Current state: no centralized redaction exists**, because no centralized
logging exists (`ARCHITECTURE.md` — no `LOGGING` setting at all, Django's
bare default console handler). This is listed as the top prerequisite for
Phase 11 (Observability) — a redaction layer needs to be designed *as part
of* introducing structured logging, not bolted on afterward once every log
call site already exists without it in mind.

## Retention

**Not yet defined for any data class.** No retention policy, no automated
purge, no documented legal basis review was found in the codebase or
project docs. This is a genuine open item requiring a business/legal
decision (who decides how long a departed student's record is kept, how
long CMS revision history is retained, how long payment records must be
kept for tax/audit purposes once real payments exist) — flagged here as
exactly the kind of "genuinely new business decision" the governing
brief's own stop-conditions call out, not something to infer and implement
unilaterally.
