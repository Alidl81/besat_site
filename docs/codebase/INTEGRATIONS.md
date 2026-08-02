# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System | Type | Purpose | Auth model | Criticality | Evidence |
|--------|------|---------|------------|-------------|----------|
| PostgreSQL | Database | Deployed application persistence | DATABASE_URL credentials | high | backend/requirements.txt; docker-compose.yml |
| django CMS REST | Internal REST API | Headless About-page content | Public read; Django admin edit | medium | backend/config/urls.py; docs/ABOUT_HEADLESS_CMS.md |
| Backend REST API | Internal API | Public site and dashboard data | Public endpoints plus JWT-protected endpoints | high | backend/config/urls.py; backend/config/settings/base.py |
| Next backend proxy | Internal HTTP adapter | Same-origin browser access and local mock dispatch | Forwards bearer/session headers | high | frontend/src/app/api/backend/[...path]/route.ts |
| GitHub Actions | CI service | Backend and frontend CMS verification | Repository workflow token, contents read | medium | .github/workflows/about-headless-cms.yml |

### 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| PostgreSQL | Production relational store | Django ORM | Availability and migration ordering | docker-compose.yml; backend/entrypoint.sh |
| SQLite | Local/test fallback | Django ORM | Accidental use outside local/test | backend/config/settings/base.py |
| JSON mock database | Frontend development fallback | frontend/src/lib/mock-api | Divergence from backend contracts | frontend/src/lib/mock-api; frontend/README.md |
| Local filesystem media | Uploaded images | Django FileSystemStorage | Multi-instance consistency and backup | backend/config/settings/base.py |

### 3) Secrets and Credentials Handling

- Credentials are read from environment variables; examples are committed while backend/.env and frontend local env files are ignored.
- Production settings require SECRET_KEY and define secure cookie/HSTS behavior.
- No secrets manager or automatic rotation integration was found. [TODO]
- Demo credentials are documented in frontend/README.md and must not be reused for real accounts.

### 4) Reliability and Failure Behavior

- The Docker entrypoint retries database connectivity with configurable attempts and delay.
- The frontend proxy applies a 30-second upstream timeout and returns a structured 502 response.
- About CMS and legacy direct fetches use five-second abort timeouts; CMS errors fall back immediately.
- No general retry/backoff or circuit-breaker layer was found for HTTP calls.

### 5) Observability for Integrations

- Proxy responses carry x-request-id, and proxy errors include the request ID.
- About CMS fallback logs a console warning.
- [TODO] No metrics, distributed tracing, APM, or centralized structured logging configuration was found.

### 6) Evidence

- backend/config/settings/base.py
- backend/config/settings/production.py
- backend/entrypoint.sh
- frontend/src/app/api/backend/[...path]/route.ts
- frontend/src/services/about-service.ts
- .github/workflows/about-headless-cms.yml
