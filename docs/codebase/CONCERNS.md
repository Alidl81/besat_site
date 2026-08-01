# Codebase Concerns

## Top Risks

| Severity | Concern | Evidence | Suggested action |
|---|---|---|---|
| Medium | Root README status says the frontend/backend are not created, contrary to the repository | `README.md`, `frontend/package.json`, `backend/manage.py` | Update onboarding status |
| Medium | No committed CI workflow or coverage threshold was found | repository scan, `frontend/package.json` | [ASK USER] choose CI and coverage policy |

## Security and Configuration

Backend settings support environment-provided secrets but include development fallbacks. Production must supply secrets and production settings; authentication and permission checks must remain enforced in Django. Local `.env` files are ignored and must not be committed.

## Fragile / High-Churn Areas

Recent history shows high churn in `backend/config/urls.py`, `backend/config/settings/base.py`, `frontend/src/components/layout/site-header.tsx`, and `frontend/src/app/globals.css`. Changes in routing and shared layout deserve focused regression tests.

## Intent vs. Reality

The root README describes an uncreated application, while the repository contains a working Next.js frontend, Django backend, Docker topology, and automated tests.

## [ASK USER] Questions

1. [ASK USER] Which CI provider and minimum unit/E2E coverage thresholds should be enforced?

## Evidence

- `README.md`
- `frontend/package.json`
- `backend/manage.py`
- `docker-compose.yml`
- `frontend/playwright.config.ts`
- `backend/config/settings/base.py`
