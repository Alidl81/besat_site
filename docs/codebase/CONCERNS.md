# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| high | Legacy About UI contains hard-coded statistics, honors, phone, and address moved from the pre-CMS page | frontend/src/components/about/about-legacy-page.tsx; parent commit history | Can conflict with the README verified-data rule | Replace with approved backend fields after product confirmation |
| medium | CMS plugin additions require coordinated edits across many backend/frontend registries and switches | backend/apps/about; frontend/src/services/about-service.ts | Easy contract drift | Add a schema/registry contract test for all layers |
| medium | Root README status says frontend/backend are not created | README.md | Misleads onboarding and planning | Update status and branching guidance |
| medium | Frontend mock JSON is large and can diverge from Django behavior | frontend/data; frontend/src/lib/mock-api | Local success may not represent production | Add contract comparison checks |
| low | No structured observability stack was found | backend/config; frontend/src | Slower production diagnosis | Define logging, metrics, and tracing requirements |

### 2) Technical Debt

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Duplicate URL-validation helpers | CMS and legacy components evolved separately | frontend/src/components/about | Inconsistent security behavior | Extract one tested HTTP(S) URL helper |
| No Python lint/format config | [TODO] repository history does not explain intent | backend/ | Style drift | Select and configure tools |
| No coverage threshold | [TODO] no policy found | backend and frontend configs | Regressions can escape despite targeted tests | Add measured baseline before setting a gate |
| Mixed mock and real backend paths | Supports frontend-first development | frontend/src/lib/mock-api; route proxy | Contract drift | Run shared fixtures against both adapters |

### 3) Security Concerns

| Risk | OWASP category | Evidence | Current mitigation | Gap |
|------|----------------|----------|--------------------|-----|
| Rich HTML injection | A03 | backend/apps/about/serializers.py; about-cms-page.tsx | nh3 sanitization with HTTP(S)-only URL schemes | Sanitizer policy is not centralized |
| Uploaded-media handling | A04 | backend/config/settings/base.py | File size limits and filesystem storage | No malware scanning/object-storage policy found |
| Demo credentials in documentation | A07 | frontend/README.md | Described as test accounts | Must ensure they never match deployed accounts |
| Dependency advisories in dev graph | A06 | npm audit output during 2026-08-02 verification | Production-only audit reports zero vulnerabilities | Two high advisories remain in development transitive dependencies |

### 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| Local filesystem media | backend/config/settings/base.py | No current symptom recorded | Media inconsistency across replicas | Use shared object storage or a dedicated media service |
| Very large static/mock assets | codebase scan metrics; frontend/data and frontend/public | Large repository/build context | Slower clone, build, and deploy | Audit and move non-runtime source assets |
| CMS/plugin query behavior | backend/apps/about/serializers.py | [TODO] no query profile recorded | Potential N+1 related-item reads | Measure API queries and prefetch if needed |

### 5) Fragile/High-Churn Areas

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| backend/config/urls.py | Central route assembly | 21 changes in the scanner window | Run URL/system checks and API tests |
| backend/config/settings/base.py | Global auth, storage, CMS, REST policy | 15 changes | Test all settings profiles and migrations |
| frontend/src/components/layout/site-header.tsx | Cross-site navigation and auth state | 15 changes | Run lint, build, and navigation tests |
| frontend/src/app/about/page.tsx | CMS/legacy feature switch | 7 changes | Run About contract and E2E suites |

### 6) [ASK USER] Questions

1. **[ASK USER]** Should the hard-coded legacy About statistics, honors, address, and phone be replaced with new backend contract fields, or are they approved official data?
2. **[ASK USER]** What minimum backend/frontend coverage threshold should become a CI gate?
3. **[ASK USER]** Is the frontend mock database a supported long-term development mode or a temporary migration aid?

### 7) Evidence

- README.md
- docs/codebase scan output captured on 2026-08-02 and removed after use
- backend/config/settings/base.py
- frontend/src/components/about/about-legacy-page.tsx
- frontend/src/lib/mock-api
- git log for the last 90 days
