# Testing Patterns

## Test Stack and Commands

- Backend: Django test runner, `docker compose exec -T backend python manage.py test`.
- Frontend: ESLint, `npm run lint`; TypeScript is checked by `npm run build`.
- E2E: no committed test-runner configuration was found. Browser verification can be run against Compose manually or with the available browser harness.

## Test Layout

Backend tests are colocated (`backend/apps/*/tests.py`, plus targeted `test_*.py` modules). There are no committed frontend `*.test.*` or `*.spec.*` files.

## Scope Matrix

| Scope | Covered? | Typical target | Notes |
|---|---|---|---|
| Unit/API | Yes | Django apps | Test modules use the Django runner |
| Integration | Partial | API/serializer/permission boundaries | Database-backed Django tests |
| E2E | No committed suite | Browser dashboard flows | [TODO] add a supported runner when product policy permits |

## Coverage and Quality Signals

No coverage threshold or CI configuration was found in the scan.

## Evidence

- `backend/apps/accounts/tests.py`
- `backend/apps/core/test_frontend_contracts.py`
- `frontend/package.json`
