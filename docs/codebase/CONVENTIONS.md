# Coding Conventions

## Naming Rules

| Item | Rule | Example |
|---|---|---|
| Frontend files | kebab-case | `dashboard-service.ts` |
| React components | PascalCase | `DashboardGuard` |
| Python modules and functions | snake_case | `test_panel_context_requires_authentication` |
| Environment variables | upper snake case | `BESAT_BACKEND_API_URL` |

## Formatting and Static Checks

Frontend linting uses ESLint and TypeScript strict mode. `npm run typecheck`, `npm run lint`, and `npm run build` are separate checks. Backend formatting configuration is [TODO].

## Imports and Errors

Frontend imports use the `@/` alias. `apiRequest` converts non-success HTTP responses into `ApiError` and performs one shared JWT refresh when appropriate. The proxy returns a structured `502` only for upstream transport failures. Django uses DRF serializers, authentication, and permission classes for API validation and authorization.

## Tests

Vitest tests use `*.test.ts(x)` files and Playwright tests live in `frontend/tests/e2e/`. Django tests are colocated in each feature app's `tests.py` or targeted `test_*.py` modules.

## Evidence

- `frontend/eslint.config.mjs`
- `frontend/tsconfig.json`
- `frontend/vitest.config.ts`
- `frontend/playwright.config.ts`
- `frontend/src/lib/api/client.ts`
- `backend/apps/dashboard/tests.py`
