# Technology Stack

## Runtime Summary

| Area | Value | Evidence |
|---|---|---|
| Frontend | TypeScript, Next.js 16.2.12, React 19.2.4 | `frontend/package.json` |
| Backend | Python/Django served by Gunicorn | `backend/requirements.txt`, `backend/Dockerfile` |
| Database | PostgreSQL 16 Alpine | `docker-compose.yml` |
| Package managers | npm (frontend), pip (backend) | `frontend/package-lock.json`, `backend/requirements.txt` |

## Production Dependencies

Next.js/React provide the browser UI; Django REST Framework, Simple JWT, and `django-cors-headers` provide the API, JWT authentication, and browser-origin policy. PostgreSQL is the Compose database.

## Development Toolchain

- `npm run dev`, `npm run build`, and `npm run lint` are defined in `frontend/package.json`.
- Django tests run through `python manage.py test`.
- Docker Compose starts `db`, `backend`, and `frontend`.

## Environment and Config

Frontend API selection uses `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_SERVER_API_BASE_URL`; backend configuration is in `backend/.env` and `backend/.env.example`. Do not commit secrets.

## Evidence

- `frontend/package.json`
- `backend/requirements.txt`
- `docker-compose.yml`
