# Architecture

## Architectural Style

Feature-organized frontend and Django backend. The frontend has components and repository/API adapters; the backend groups model, serializer, permission, and view code by feature.

## System Flow

```text
Browser UI -> frontend API client -> Django /api/ route -> DRF view/serializer -> PostgreSQL -> JSON response
```

Client-only controls can bypass the API: the CSV template control in `frontend/src/components/crud/excel-import.tsx` creates a Blob and browser download directly.

## Layer Responsibilities

| Module | Owns | Evidence |
|---|---|---|
| `frontend/src/lib/api/client.ts` | URL normalization, JWT headers, request error handling | `frontend/src/lib/api/client.ts` |
| `frontend/src/components/crud/` | CRUD user interactions | `frontend/src/components/crud/simple-managers.tsx` |
| `backend/config/urls.py` | Root API inclusion | `backend/config/urls.py` |
| `backend/apps/*` | Feature API implementations | `backend/apps/accounts/views.py` |

## Known Risks

- Browser-generated templates have no backend download endpoint, response headers, or server-side audit trail.
- Public API URL configuration is host-browser specific; the Compose file uses the host-published backend port for browser calls and Docker DNS only for server-side calls.

## Evidence

- `docker-compose.yml`
- `frontend/src/lib/api/client.ts`
- `backend/config/urls.py`
