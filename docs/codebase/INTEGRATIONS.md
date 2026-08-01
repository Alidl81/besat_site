# External Integrations

## Integration Inventory

| System | Purpose | Connection / auth |
|---|---|---|
| PostgreSQL | Django application data | `DATABASE_URL`; Compose service `db` |
| Django REST API | Public content and authenticated dashboard/CMS operations | Same-origin Next.js proxy, JWT Bearer tokens |
| Filesystem media/static | Django uploads and collected static files | Docker volumes / configured paths |

## Frontend-to-Backend Gateway

Browser requests use `/api/backend/*`. The App Router catch-all forwards method, query, body, files, cookies, and authorization headers to `BESAT_BACKEND_API_URL`. `mock://local` is an explicit test/development mode; real upstream failures return a structured `502` and are not replaced with fake domain data.

## Docker Networking

Compose places `db`, `backend`, and `frontend` on the default project network. The frontend reaches Django via the service hostname `backend`; host browsers reach Next.js on port 3000. Database and backend health checks gate dependent services.

## Credentials and Observability

Environment templates document required variables. Only templates should be committed. Runtime evidence is available through Next.js request logs, Django logs, Compose health state, and `docker compose logs`; no metrics or distributed tracing integration was found.

## Evidence

- `docker-compose.yml`
- `frontend/src/app/api/backend/[...path]/route.ts`
- `frontend/.env.example`
- `backend/.env.example`
- `backend/config/settings/base.py`
