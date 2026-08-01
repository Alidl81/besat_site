# Technology Stack

## Runtime Summary

| Area | Version / implementation | Package manager |
|---|---|---|
| Frontend | Node 22 Alpine, Next.js 16.2.9, React 19.2.4, TypeScript 5 | npm with `package-lock.json` |
| Backend | Python 3.12, Django 5.2–6.0, Django REST Framework 3.15–3.x | pip with `requirements.txt` |
| Database | PostgreSQL 16 Alpine | Docker image |

## Runtime Dependencies

The frontend uses Next.js App Router and React. The backend uses Django REST Framework, Simple JWT, django-cors-headers, django-filter, drf-spectacular, psycopg, Gunicorn, and WhiteNoise. Docker Compose supplies PostgreSQL and the service network.

## Development Toolchain

- Frontend scripts: `dev`, `build`, `typecheck`, `lint`, Vitest unit tests, Playwright E2E tests, and an editor API smoke test.
- Backend checks and tests use `python manage.py check` and `python manage.py test`.
- Docker images use `node:22-alpine` and `python:3.12-slim`.

## Environment and Configuration

Browser API traffic uses `NEXT_PUBLIC_API_BASE_URL`; the server-only upstream is `BESAT_BACKEND_API_URL`, with `NEXT_SERVER_API_BASE_URL` available for server-side calls. Templates are in `frontend/.env.example` and `backend/.env.example`; secrets must not be committed.

## Evidence

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/Dockerfile`
- `backend/requirements.txt`
- `backend/Dockerfile`
- `docker-compose.yml`
