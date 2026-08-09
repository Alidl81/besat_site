# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| Python files/functions | snake_case | ensure_about_cms_page.py; validate_http_url | backend/apps/about |
| Python classes | PascalCase | AboutPageSerializer | backend/apps/about/serializers.py |
| Frontend files | kebab-case for components/services | about-cms-page.tsx | frontend/src/components/about |
| TypeScript components/types | PascalCase | AboutCmsPage | frontend/src/services/about-service.ts |
| TypeScript functions/variables | camelCase | resolveAboutPage | frontend/src/services/about-service.ts |
| Environment variables | upper snake case | USE_DJANGO_CMS_ABOUT | frontend/.env.example |

### 2) Formatting and Linting

- Frontend formatter: no separate formatter configuration was found; TypeScript style is enforced primarily by ESLint and compiler checks.
- Frontend linter: ESLint 9 with Next core-web-vitals and TypeScript presets in frontend/eslint.config.mjs.
- React set-state-in-effect and explicit-any findings are configured as warnings.
- TypeScript uses strict mode, noEmit, bundler resolution, and isolatedModules in frontend/tsconfig.json.
- Python formatter/linter: [TODO] no repository configuration was found.
- Commands: npm run lint and npx tsc --noEmit.

### 3) Import and Module Conventions

- Frontend code uses @/ for imports rooted at frontend/src.
- Python code uses absolute app imports for cross-app dependencies and relative imports within a feature.
- No barrel-export policy is documented; representative code imports concrete modules.

### 4) Error and Logging Conventions

- DRF views return serialized API errors; project-wide authentication, throttling, and JSON rendering are configured in backend/config/settings/base.py.
- Frontend request helpers throw for non-success responses; the About CMS adapter catches CMS failures and falls back to the legacy API.
- The backend proxy returns a stable 502 payload with a request ID.
- Logging is mostly framework defaults and console warnings. An empty/unavailable About CMS page logs a server warning before the legacy fallback. [TODO] No structured application logging or sensitive-field redaction policy was found.

### 5) Testing Conventions

- Django uses tests.py and test_*.py files inside each app with django.test.TestCase and DRF APIClient.
- Frontend uses *.spec.ts under frontend/tests and Playwright expect assertions; the general E2E configuration excludes the separately orchestrated About CMS suite.
- Test data is created in each test or loaded from explicit fixtures.
- Coverage expectation: [TODO] no enforced threshold was found.

### 6) Evidence

- frontend/eslint.config.mjs
- frontend/tsconfig.json
- frontend/src/services/about-service.ts
- backend/apps/about/test_headless_cms.py
- backend/config/settings/base.py
