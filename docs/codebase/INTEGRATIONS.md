# External Integrations

## Integration Inventory

| System | Type | Purpose | Auth model | Evidence |
|---|---|---|---|---|
| PostgreSQL | Database | Django application data | database URL environment variable | `docker-compose.yml`, `backend/config/settings/base.py` |
| Django API | HTTP API | Frontend data operations | JWT Bearer token | `frontend/src/lib/api/client.ts`, `backend/config/settings/base.py` |

## Data Stores

PostgreSQL is the Compose `db` service. Django also configures filesystem media at `/app/media` and static output at `/app/staticfiles` in the backend container.

## Credentials

Configuration reads environment variables and `backend/.env`; only templates such as `backend/.env.example` should be inspected or committed. [TODO] Define a production secret-rotation process.

## Reliability and Observability

Compose defines health checks for database and backend. Backend logs are available through `docker compose logs backend`; no metrics or tracing integration was found.

## Evidence

- `docker-compose.yml`
- `backend/config/settings/base.py`
- `backend/.env.example`
