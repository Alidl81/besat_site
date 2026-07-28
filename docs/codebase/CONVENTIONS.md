# Coding Conventions

## Naming Rules

| Item | Rule | Example | Evidence |
|---|---|---|---|
| Frontend files | kebab-case | `excel-import.tsx` | `frontend/src/components/crud/` |
| React components | PascalCase | `ExcelImport` | `frontend/src/components/crud/excel-import.tsx` |
| Python modules | snake_case filenames | `test_frontend_contracts.py` | `backend/apps/core/` |
| Env vars | upper snake case | `NEXT_PUBLIC_API_BASE_URL` | `docker-compose.yml` |

## Formatting and Linting

Frontend linting uses ESLint through `npm run lint`. TypeScript strict mode is enabled. Backend formatting configuration is [TODO].

## Imports and Errors

Frontend uses the `@/` alias. `apiRequest` throws `ApiRequestError` for non-success responses; Django views use DRF serializers and permission classes.

## Testing

Django tests are colocated in application test modules. No committed frontend unit or E2E runner configuration was found.

## Evidence

- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/src/lib/api/client.ts`
- `backend/apps/accounts/views.py`
