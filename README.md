# Besat Site

Besat Site is a full-stack school website and role-based management portal.
The frontend is Next.js 16/React 19, the API is Django 6 with Django REST
Framework and JWT authentication, and PostgreSQL is the production database.

## Repository layout

```text
frontend/   Next.js public site, dashboards, proxy route, and Playwright tests
backend/    Django API, django CMS About page, migrations, and test suite
docs/       Contracts and codebase knowledge documents
```

## Local development

Backend (PowerShell):

```powershell
cd backend
py -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Frontend, in another terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm.cmd ci
npm.cmd run dev
```

The default frontend URL is `http://127.0.0.1:3000` and the API health endpoint
is `http://127.0.0.1:8000/api/health/`. If Windows reserves port 3000, run the
frontend with `npm.cmd run dev -- --port 3200` and add that origin to the Django
CORS and CSRF environment variables.

## Docker Compose

The root Compose file is the only Compose definition. It builds production
images and connects the frontend to the backend by the internal service name
`backend`; PostgreSQL is reached as `db`. Named volumes preserve database,
static, and uploaded media data.

```powershell
Copy-Item .env.example .env
# Replace every change-me value in .env.
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs
docker compose down
```

## Quality checks

```powershell
cd backend
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test --settings=config.settings.test

cd ..\frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run test:about:unit
npm.cmd run build
npm.cmd run test:e2e
```

Playwright downloads can be blocked in some regions. When Chrome is already
installed, set `PLAYWRIGHT_CHANNEL=chrome` before running the E2E suite.

Never commit `.env`, `backend/.env`, or `frontend/.env.local`. Public content
must come from verified school sources; development-only mock data must remain
clearly identified and must not be treated as production data.

## Product and data policy

The production site must not contain guessed, fabricated, or unapproved school
information. Text, statistics, images, news, achievements, contact details,
registration details, staff records, and unit/department descriptions must come
from official or school-approved sources. Temporary UI data must be explicitly
identified as a placeholder or test fixture and must not ship as authoritative
content.

The frontend owns presentation and interaction; it must consume REST contracts
instead of accessing persistence directly. Django owns validation, permissions,
workflow rules, API representation, database access, and administrative editing.
The initial public contract includes site settings, home, units, departments,
news, gallery, achievements, contact, and registration endpoints under `/api/`.

## Development workflow

Keep feature changes scoped, run the relevant backend and frontend checks before
handoff, and use focused commits such as `feat:`, `fix:`, `docs:`, or `chore:`
when the work is ready to commit. Shared REST contracts and content-verification
notes belong under `docs/`; detailed current architecture and testing evidence
is maintained in `docs/codebase/`.
