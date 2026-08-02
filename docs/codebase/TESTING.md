# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Backend framework: Django test runner with TestCase and DRF APIClient; versions follow backend/requirements.txt.
- Frontend framework: Playwright ^1.62.0, used for contract-style unit tests and browser E2E.
- Assertions/mocking: unittest/Django assertions, Playwright expect, explicit async function injection for About fallback tests.

    cd backend
    python manage.py check
    python manage.py makemigrations --check --dry-run
    python manage.py test

    cd frontend
    npm run lint
    npx tsc --noEmit
    npm run test:about:unit
    npm run test:about:e2e
    npm run build

### 2) Test Layout

- Django tests live inside each feature app as tests.py or test_*.py.
- Frontend tests live in frontend/tests/unit and frontend/tests/e2e with *.spec.ts naming.
- Frontend test fixtures live under frontend/tests/e2e/fixtures.
- Playwright configuration is split between the general suite and About-specific unit/E2E configurations.
- Django test settings are in backend/config/settings/test.py.

### 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit/contract | yes | About payload parser and fallback decision | Playwright test runner without browser page usage |
| Backend integration | yes | ORM, CMS plugins, serializers, API routes, commands | Django test database |
| Frontend E2E | yes | About CMS rendering and fallback | Chromium plus a local API stub |
| Full cross-container E2E | [TODO] | Browser through Next to live Django/PostgreSQL | No explicit suite found |

### 4) Mocking and Isolation Strategy

- Django creates an isolated test database and uses TemporaryDirectory for media in About tests.
- Frontend About unit tests inject fetchCms and fetchLegacy functions.
- About E2E uses frontend/tests/e2e/about-api-stub.mjs and a JSON fixture.
- Playwright run-state and reports are generated artifacts and are ignored.

### 5) Coverage and Quality Signals

- Coverage tool and threshold: [TODO] none configured.
- Current coverage: [TODO] not reported.
- CI checks backend system checks, migration drift, About tests, TypeScript, and About browser tests.
- Repository-wide ESLint currently permits warnings; the warning inventory includes pre-existing image and effect findings.

### 6) Evidence

- backend/config/settings/test.py
- backend/apps/about/test_headless_cms.py
- frontend/tests/unit/about-service.spec.ts
- frontend/tests/e2e/about-cms.spec.ts
- frontend/playwright.about.config.ts
- .github/workflows/about-headless-cms.yml
