# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| backend/ | Django project, feature apps, migrations, API, and deployment files | backend/manage.py; backend/config/urls.py |
| frontend/ | Next.js public site, dashboard, services, proxy, and tests | frontend/package.json; frontend/src/app |
| docs/ | Shared product notes, API contracts, and architecture documentation | README.md; docs/backend_contracts/README.md |
| .github/workflows/ | Continuous-integration workflows | .github/workflows/about-headless-cms.yml |
| docker-compose.yml | Integrated frontend/backend/database runtime | docker-compose.yml |
| README.md | Project intent, data rules, and workflow guidance | README.md |

### 2) Entry Points

- Backend CLI entry: backend/manage.py.
- Backend web entry: backend/config/wsgi.py, launched by backend/entrypoint.sh through Gunicorn.
- Backend route entry: backend/config/urls.py.
- Frontend route entry: frontend/src/app; commands are selected by frontend/package.json.
- Frontend backend-proxy entry: frontend/src/app/api/backend/[...path]/route.ts.
- Secondary startup task: backend/apps/about/management/commands/ensure_about_cms_page.py.

### 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| backend/apps/<feature>/ | Feature models, serializers, permissions, URLs, views, migrations, tests | Browser rendering |
| backend/config/ | Cross-project settings, URL assembly, ASGI/WSGI | Feature-specific domain rules |
| frontend/src/app/ | Next App Router pages, layouts, and route handlers | Django persistence logic |
| frontend/src/components/ | Reusable UI and feature rendering | Direct database access |
| frontend/src/services/ and src/lib/api/ | API contracts, normalization, request adapters | Page layout |
| docs/backend_contracts/ | Frontend-driven backend contracts | Executable runtime code |

### 4) Naming and Organization Rules

- Django apps are domain/feature directories using snake_case Python files.
- Frontend component and service filenames use kebab-case; exported components and types use PascalCase.
- Tests are co-located in Django apps and placed in frontend/tests for Playwright.
- TypeScript imports may use the @/ alias, mapped to frontend/src by frontend/tsconfig.json.
- Generated output such as frontend/.next, frontend/test-results, backend/staticfiles, and Python caches is not source.

### 5) Evidence

- docs/codebase/.codebase-scan.txt was used during discovery and intentionally removed after documentation.
- backend/config/urls.py
- backend/apps/about/
- frontend/src/app/
- frontend/src/services/about-service.ts
- frontend/tsconfig.json
