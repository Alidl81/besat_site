# Changed files

Compared with the authoritative `frontend.zip` SHA-256
`F1CDD7AFF56B5AE265CD613751C06A4DCA44E320D51E10C7A1B3A93122C76FED`
and backend branch `backend/mvp-bootstrap` commit
`ea5860fec717e0cc37d4fc1d16a4938adef1a917`.

Generated `.next`, Playwright report/result, and `node_modules` files are
excluded.
The runtime-local `data/mock-database.local.json` is also excluded from version
control.

## Frontend added

- `.env.example`
- `docs/CHANGED_FILES.md`
- `docs/FRONTEND_BACKEND_ENDPOINT_MAP.md`
- `playwright.config.ts`
- `scripts/sanitize-mock-database.mjs`
- `src/app/achievements/[slug]/page.tsx`
- `src/app/achievements/page.tsx`
- `src/components/about/about-content.tsx`
- `src/components/achievements/achievement-detail.tsx`
- `src/components/achievements/achievements-list.tsx`
- `src/components/contact/contact-form.test.ts`
- `src/components/contact/contact-page-content.tsx`
- `src/components/content/editorjs-content-renderer.tsx`
- `src/components/dashboard/dashboard-mobile-menu.tsx`
- `src/components/gallery/gallery-explorer.test.ts`
- `src/components/gallery/gallery-explorer.tsx`
- `src/components/news/news-hub.tsx`
- `src/components/units/unit-content-page.tsx`
- `src/components/units/unit-overview.tsx`
- `src/components/units/unit-registration-cta.tsx`
- `src/hooks/use-reduced-motion.ts`
- `src/lib/api/client.test.ts`
- `src/lib/content/sanitize-cms-html.test.ts`
- `src/lib/content/sanitize-cms-html.ts`
- `src/lib/editor/serial-save-queue.test.ts`
- `src/lib/editor/serial-save-queue.ts`
- `src/lib/media/safe-url.ts`
- `src/lib/news/partition-news.test.ts`
- `src/lib/news/partition-news.ts`
- `src/services/public-content-service.ts`
- `src/test/setup.ts`
- `src/types/public-content.ts`
- `tests/e2e/panel.spec.ts`
- `tests/e2e/prepare-db.mjs`
- `tests/e2e/public-and-navigation.spec.ts`
- `vitest.config.ts`

## Frontend modified

- `data/mock-database.seed.json`
- `docs/BACKEND_API_CONTRACT.md`
- `docs/MOCK_DATABASE.md`
- `eslint.config.mjs`
- `next.config.ts`
- `next-env.d.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `scripts/smoke-editor-api.mjs`
- `src/app/about/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/gallery/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/media/settings/page.tsx`
- `src/app/news/page.tsx`
- `src/app/page.tsx`
- `src/app/parents/children/page.tsx`
- `src/app/parents/programs/page.tsx`
- `src/app/parents/registration/page.tsx`
- `src/app/parents/requests/page.tsx`
- `src/app/registration/page.tsx`
- `src/app/unit-manager/programs/page.tsx`
- `src/app/unit-manager/requests/page.tsx`
- `src/app/unit-manager/settings/page.tsx`
- `src/app/units/[slug]/gallery/page.tsx`
- `src/app/units/[slug]/news/page.tsx`
- `src/app/units/[slug]/page.tsx`
- `src/components/auth/dashboard-guard.tsx`
- `src/components/auth/preregistration-card.tsx`
- `src/components/circular/circular-explorer.tsx`
- `src/components/circular/scoped-tabs.tsx`
- `src/components/circular/units-explorer-section.tsx`
- `src/components/cms/media-picker-dialog.tsx`
- `src/components/contact/contact-form.tsx`
- `src/components/content/news-detail-content.tsx`
- `src/components/content/rich-content-renderer.tsx`
- `src/components/crud/use-collection.ts`
- `src/components/dashboard/dashboard-data.ts`
- `src/components/dashboard/dashboard-section-content.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/editorial-workspace.tsx`
- `src/components/home/home-experience-section.tsx`
- `src/components/home/home-news-section.tsx`
- `src/components/home/home-slider-section.tsx`
- `src/components/home/home-units-carousel.tsx`
- `src/components/home/home-units-section.tsx`
- `src/components/layout/page-motion.tsx`
- `src/components/layout/public-page-layout.tsx`
- `src/components/layout/site-footer.tsx`
- `src/components/layout/site-header.tsx`
- `src/components/registration/registration-grade-selector.tsx`
- `src/components/virtual-tour/virtual-tour-lobby.tsx`
- `src/lib/api/client.ts`
- `src/lib/auth/auth-session.ts`
- `src/lib/mock-api/handler.ts`
- `src/lib/mock-api/helpers.ts`
- `src/lib/mock-api/serializers.ts`
- `src/services/panel-service.ts`
- `src/types/panel-api.ts`

## Frontend removed

- `src/app/dashboard/admin/reports/page.tsx`
- `src/app/dashboard/admin/services/page.tsx`
- `src/app/dashboard/admin/settings/page.tsx`
- `src/app/dashboard/media/services/page.tsx`
- `src/app/dashboard/media/settings/page.tsx`
- `src/app/dashboard/parents/announcements/page.tsx`
- `src/app/dashboard/parents/children/page.tsx`
- `src/app/dashboard/parents/gallery/page.tsx`
- `src/app/dashboard/parents/programs/page.tsx`
- `src/app/dashboard/parents/registration/page.tsx`
- `src/app/dashboard/parents/requests/page.tsx`
- `src/app/dashboard/parents/services/page.tsx`
- `src/app/dashboard/unit-manager/attendance/page.tsx`
- `src/app/dashboard/unit-manager/classes/page.tsx`
- `src/app/dashboard/unit-manager/programs/page.tsx`
- `src/app/dashboard/unit-manager/requests/page.tsx`
- `src/app/dashboard/unit-manager/settings/page.tsx`
- `src/lib/data/seed-data.ts`

## Backend modified

- `apps/about/cms.py`
- `apps/about/models.py`
- `apps/about/serializers.py`
- `apps/about/views.py`
- `apps/accounts/cms.py`
- `apps/announcements/views.py`
- `apps/contact/models.py`
- `apps/contact/serializers.py`
- `apps/content/cms.py`
- `apps/core/test_frontend_contracts.py`
- `apps/dashboard/cms_serializers.py`
- `apps/dashboard/cms_views.py`
- `apps/dashboard/serializers.py`
- `apps/dashboard/tests.py`
- `apps/dashboard/urls.py`
- `apps/dashboard/views.py`
- `apps/events/serializers.py`
- `apps/events/views.py`
- `apps/gallery/models.py`
- `apps/gallery/serializers.py`
- `apps/gallery/urls.py`
- `apps/gallery/views.py`
- `apps/news/models.py`
- `apps/news/serializers.py`
- `apps/news/validators.py`
- `apps/news/views.py`
- `apps/registration/serializers.py`
- `apps/units/models.py`
- `apps/units/serializers.py`

## Backend added

- `apps/about/migrations/0002_aboutpage_founders_aboutpage_goals_aboutpage_history_and_more.py`
- `apps/contact/migrations/0002_contactmessage_message_type_and_more.py`
- `apps/core/test_completion_contracts.py`
- `apps/gallery/migrations/0003_mediaasset.py`
- `apps/news/migrations/0005_news_is_important_news_priority_and_more.py`
- `apps/units/migrations/0005_schoolunit_accepts_registration_schoolunit_address_and_more.py`
