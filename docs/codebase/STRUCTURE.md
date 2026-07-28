# Codebase Structure

## Top-Level Map

| Path | Purpose | Evidence |
|---|---|---|
| `frontend/` | Next.js application | `frontend/package.json` |
| `backend/` | Django API and domain apps | `backend/manage.py`, `backend/apps/` |
| `docs/` | Shared contracts and repository documentation | `docs/backend_contracts/` |
| `docker-compose.yml` | Local full-stack topology | `docker-compose.yml` |

## Entry Points

- Frontend: `frontend/package.json` runs `next dev`.
- Backend: `backend/entrypoint.sh` starts the Django/Gunicorn service.
- Django routes begin in `backend/config/urls.py`.

## Module Boundaries

| Boundary | What belongs here | What must not be here |
|---|---|---|
| `frontend/src/components/` | UI and browser interaction | Django persistence |
| `frontend/src/lib/` | API/auth/data adapters | page layout markup |
| `backend/apps/` | Feature models, serializers, permissions, views | frontend presentation |
| `backend/config/` | Django configuration and root routes | feature-specific business logic |

## Naming and Organization Rules

Frontend source files use kebab-case; React component exports use PascalCase. Django is organized by feature app with familiar `models.py`, `serializers.py`, `views.py`, `urls.py`, and `tests.py` files. Frontend imports use `@/*` for `frontend/src/*`.

## Evidence

- `frontend/tsconfig.json`
- `backend/apps/`
- `docs/codebase/.codebase-scan.txt`
