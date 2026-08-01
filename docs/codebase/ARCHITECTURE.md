# Architecture

## Architectural Style

The repository is a two-service web application: a Next.js App Router frontend and a feature-organized Django REST Framework backend. PostgreSQL is the persistent store in Docker; an explicit JSON mock backend is available for isolated frontend development and E2E tests.

## Request Flow

```text
Browser
  -> /api/backend/<route> on Next.js
  -> catch-all Route Handler (headers/body/query/JWT preserved)
  -> BESAT_BACKEND_API_URL/<canonical slash route>
  -> Django CommonMiddleware, JWT authentication, DRF permission/view/serializer
  -> PostgreSQL
  -> JSON response through the Route Handler
```

Server-side frontend calls may use `NEXT_SERVER_API_BASE_URL` directly. In Docker, both server-only frontend variables resolve through Compose DNS to `http://backend:8000/api`; browser calls stay same-origin at `/api/backend`.

## Routing Contract

Django registers slash-terminated routes such as `/api/me/`, `/api/dashboard/context/`, and `/api/dashboard/general-manager/`. The frontend catch-all accepts slash and non-slash browser variants and canonicalizes the upstream path, preventing Django's relative slash redirect from escaping the `/api/backend` proxy prefix.

## Authentication Boundary

The client attaches JWT access tokens as `Authorization: Bearer ...`; the proxy preserves that header. Django's authentication and permission classes remain authoritative for `401` and `403` decisions.

## Evidence

- `frontend/src/app/api/backend/[...path]/route.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/endpoints.ts`
- `backend/config/settings/base.py`
- `backend/config/urls.py`
- `backend/apps/dashboard/urls.py`
- `docker-compose.yml`
