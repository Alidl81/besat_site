# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: two-application web system with a feature-oriented Django REST backend and a Next.js App Router frontend.
- The backend groups models, serializers, views, URLs, and tests by school-domain feature. The frontend groups route composition under src/app and shared behavior under components, services, and lib.
- Primary constraints: public content must originate from approved sources; the frontend consumes REST contracts; django CMS is headless and limited to the About page.

### 2) System Flow

    Browser -> Next.js page/server component -> frontend service or /api/backend proxy
    -> Django URL/view/serializer -> Django ORM/PostgreSQL or django CMS
    -> JSON contract -> frontend validation/renderer -> HTML response

For the CMS path:

1. frontend/src/app/about/page.tsx asks frontend/src/services/about-service.ts to resolve the page.
2. The service reads the server-side feature flag and calls djangocms-rest with a five-second timeout.
3. The service validates the content placeholder and supported plugin contracts.
4. backend/apps/about/serializers.py sanitizes rich HTML and serializes plugin data.
5. frontend/src/components/about/about-cms-page.tsx renders supported plugins.
6. Any CMS fetch or contract failure uses the legacy GET /api/about/ path.

### 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| Django models | Persistence constraints and upload paths | HTTP presentation | backend/apps/about/models.py |
| DRF serializers/views | API representation and request handling | React presentation | backend/apps/about/serializers.py; backend/apps/about/views.py |
| Django settings/URLs | Runtime wiring and global policy | Feature UI | backend/config/settings/base.py; backend/config/urls.py |
| Frontend services | Fetching, contract validation, fallback selection | Visual layout | frontend/src/services/about-service.ts |
| Frontend components | Rendering and interaction | Database access | frontend/src/components/about/about-cms-page.tsx |
| Backend proxy | Same-origin forwarding or mock dispatch | Feature-specific page rendering | frontend/src/app/api/backend/[...path]/route.ts |

### 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Feature modules | backend/apps/* | Keeps domain models/API/tests together |
| Serializer boundary | backend/apps/*/serializers.py | Produces stable JSON contracts |
| Adapter/fallback | frontend/src/services/about-service.ts | Switches CMS and legacy sources without changing the page |
| Repository/service functions | frontend/src/lib/data and frontend/src/services | Separates data access from components |
| Environment-driven configuration | backend/config/settings; frontend services | Supports local, container, CI, and production deployments |

### 5) Known Architectural Risks

- Adding a CMS plugin requires coordinated backend model, migration, registry, serializer, settings, TypeScript contract, normalizer, and renderer changes.
- The CMS and legacy About sources have different content breadth; legacy static sections remain outside the backend About API.
- The frontend proxy and direct CMS fetch paths use different timeout and failure-handling policies.

### 6) Evidence

- README.md
- docs/ABOUT_HEADLESS_CMS.md
- backend/config/urls.py
- backend/apps/about/serializers.py
- frontend/src/services/about-service.ts
- frontend/src/app/api/backend/[...path]/route.ts
