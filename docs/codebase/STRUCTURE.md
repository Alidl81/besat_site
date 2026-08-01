# Codebase Structure

## Top-Level Map

| Path | Purpose |
|---|---|
| `frontend/` | Next.js App Router UI, same-origin API route handler, API clients, Vitest, and Playwright tests |
| `backend/` | Django/DRF API grouped into feature apps |
| `docs/` | Shared implementation notes, API contracts, and codebase map |
| `docker-compose.yml` | Local PostgreSQL, backend, and frontend topology |

## Entry Points

- Frontend commands are defined in `frontend/package.json`; routes live under `frontend/src/app/`.
- The catch-all frontend API proxy is `frontend/src/app/api/backend/[...path]/route.ts`.
- Django starts through `backend/entrypoint.sh`; root URLs are registered in `backend/config/urls.py`.

## Module Boundaries

| Boundary | Responsibility |
|---|---|
| `frontend/src/app/` | Pages, layouts, and Route Handlers |
| `frontend/src/lib/api/` and `frontend/src/services/` | URL normalization, JWT headers, error handling, and domain API calls |
| `frontend/src/lib/mock-api/` | Explicit `mock://local` development/test backend |
| `backend/apps/*` | Feature models, serializers, views, permissions, and URL registration |
| `backend/config/` | Django settings, root routing, WSGI, and ASGI |

## Naming and Organization

Frontend files use kebab-case and React exports use PascalCase. Python modules use snake_case. Frontend imports map `@/*` to `frontend/src/*`; Django is organized by feature app.

## Evidence

- `frontend/src/app/`
- `frontend/src/lib/api/client.ts`
- `frontend/src/app/api/backend/[...path]/route.ts`
- `backend/apps/`
- `backend/config/urls.py`
- `frontend/tsconfig.json`
