# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Backend language | Python | backend/manage.py |
| Backend runtime | Python 3.12 in the container | backend/Dockerfile |
| Frontend language | TypeScript and React | frontend/tsconfig.json; frontend/package.json |
| Frontend runtime | Node.js 22 on Alpine in the container | frontend/Dockerfile |
| Package managers | pip requirements and npm lockfile | backend/requirements.txt; frontend/package-lock.json |
| Build systems | Django management/Gunicorn and Next.js | backend/entrypoint.sh; frontend/package.json |

### 2) Production Frameworks and Dependencies

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| Django | >=5.2,<6.1 | Backend web framework and ORM | backend/requirements.txt |
| Django REST Framework | >=3.15,<4.0 | REST API | backend/requirements.txt |
| django CMS | >=5.0.9,<5.1 | Headless About-page CMS | backend/requirements.txt |
| djangocms-rest | >=1.2,<1.3 | CMS REST serialization | backend/requirements.txt |
| Simple JWT | >=5.3,<6.0 | API authentication | backend/requirements.txt; backend/config/settings/base.py |
| psycopg | >=3.2,<4.0 | PostgreSQL driver | backend/requirements.txt |
| Next.js | ^16.2.12 | Frontend App Router framework | frontend/package.json |
| React | 19.2.4 | Frontend rendering | frontend/package.json |
| Tiptap | ^3.27.1 | Dashboard rich-content editing | frontend/package.json |

### 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| ESLint 9 with Next rules | Frontend linting | frontend/eslint.config.mjs |
| TypeScript 5 strict mode | Static checks | frontend/tsconfig.json |
| Playwright 1.62 | Unit-contract and E2E tests | frontend/package.json; frontend/playwright.config.ts |
| Django test runner | Backend tests | backend/manage.py; backend/apps/about/test_headless_cms.py |
| GitHub Actions | About CMS CI | .github/workflows/about-headless-cms.yml |
| Docker Compose | Local integrated runtime | docker-compose.yml |

### 4) Key Commands

    cd backend
    pip install -r requirements.txt
    python manage.py check
    python manage.py test --settings=config.settings.test

    cd frontend
    npm ci
    npm run lint
    npx tsc --noEmit
    npm run build
    npm run test:e2e

    docker compose config --quiet
    docker compose build
    docker compose up -d
    docker compose down

### 5) Environment and Config

- Config sources: backend/config/settings/, root .env.example, backend/.env.example, frontend/.env.example, and docker-compose.yml.
- Required or deployment-sensitive variables include SECRET_KEY, DATABASE_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS, BESAT_BACKEND_API_URL, and the About CMS variables documented in docs/ABOUT_HEADLESS_CMS.md.
- The committed examples contain variable names and placeholders only; root .env, backend/.env, backend/docker.env, and frontend local env files are ignored by .gitignore.
- PostgreSQL is the declared deployed database; backend settings default to SQLite for local development.

### 6) Evidence

- backend/requirements.txt
- backend/Dockerfile
- backend/config/settings/base.py
- frontend/package.json
- frontend/tsconfig.json
- frontend/Dockerfile
- docker-compose.yml
