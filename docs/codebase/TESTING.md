# Testing Patterns

## Test Stack and Commands

- Frontend unit/integration: Vitest with jsdom via `npm test`.
- Frontend browser E2E: Playwright with Chrome across mobile, tablet, laptop, and desktop projects via `npm run test:e2e`.
- Frontend quality: `npm run lint`, `npm run typecheck`, and `npm run build`.
- Backend: Django's database-backed test runner via `python manage.py test`.
- Docker/runtime: health checks, direct/proxied HTTP probes, and service logs.

## Test Layout and Isolation

Frontend unit tests are colocated as `*.test.ts(x)`. E2E specs are in `frontend/tests/e2e/`; `prepare-db.mjs` copies a seed to an OS temporary file and injects an isolated account. Django tests are colocated in `backend/apps/*/tests.py` and targeted `test_*.py` files.

## Dashboard Coverage

`backend/apps/dashboard/tests.py` covers authenticated roles, scope, `401`, and `403` behavior. The frontend proxy regression test covers slash normalization, redirect prevention, authorization-header forwarding, query preservation, and the working `/me/` route. The panel E2E test verifies the context and general-manager responses and visible dashboard loading.

## Coverage and CI

No repository-wide coverage threshold or committed CI workflow was found. [ASK USER] Select the team's required coverage thresholds and CI provider before making them release gates.

## Evidence

- `frontend/vitest.config.ts`
- `frontend/playwright.config.ts`
- `frontend/src/app/api/backend/[...path]/route.test.ts`
- `frontend/tests/e2e/panel.spec.ts`
- `backend/apps/dashboard/tests.py`
- `frontend/package.json`
