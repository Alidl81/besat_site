# Codebase Concerns

## Top Risks

| Severity | Concern | Evidence | Impact | Suggested action |
|---|---|---|---|---|
| Medium | No committed frontend automated-test runner | `frontend/package.json` | Dashboard browser regressions rely on manual checks | [ASK USER] choose and approve a frontend test runner |
| Medium | Browser template download has no API endpoint by design | `frontend/src/components/crud/excel-import.tsx` | Backend settings cannot fix a browser-only defect | Keep browser E2E coverage for the client-only flow |
| Low | Root README status is stale relative to code | `README.md`, `frontend/package.json`, `backend/manage.py` | Misleading onboarding information | Update project status |

## Technical Debt

The scan reports large imported/static HTML and image assets under `frontend/public/images/home-slider/`; keep generated/imported assets separate from application source conventions.

## Security Concerns

| Risk | OWASP category | Evidence | Current mitigation | Gap |
|---|---|---|---|---|
| Default Django secret fallback | A02 | `backend/config/settings/base.py` | Environment configuration is supported | Production must supply a secret |

## Fragile/High-Churn Areas

`backend/config/urls.py`, `backend/config/settings/base.py`, and `frontend/src/components/layout/site-header.tsx` are high-churn according to the scan; make focused, verified changes.

## [ASK USER] Questions

1. [ASK USER] Which supported frontend E2E runner should be adopted for CI: Playwright, Cypress, or another team-standard tool?

## Evidence

- `docs/codebase/.codebase-scan.txt`
- `frontend/src/components/crud/excel-import.tsx`
- `backend/config/settings/base.py`
