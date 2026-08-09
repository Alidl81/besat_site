# Headless django CMS contract for `/about`

## Scope

Only the public About page is controlled by django CMS. All existing API routes,
models, dashboard endpoints, and public pages remain unchanged.

## Runtime selection

```dotenv
USE_DJANGO_CMS_ABOUT=true
DJANGO_CMS_API_BASE_URL=http://backend:8000/api/headless-cms
DJANGO_CMS_ABOUT_LANGUAGE=fa-ir
ABOUT_FALLBACK_API_URL=http://backend:8000/api/about/
```

When the flag is `false`, Next.js reads the current `GET /api/about/` endpoint.
When the flag is `true`, Next.js requests:

```http
GET /api/headless-cms/fa-ir/pages/about/
```

A timeout, non-2xx response, malformed payload, missing placeholder, or a page
without supported plugins causes an immediate fallback to `GET /api/about/`.

## Page bootstrap

The backend startup runs this idempotent command after migrations:

```bash
python manage.py ensure_about_cms_page
```

It creates or repairs one django CMS page with:

- slug/path: `about`
- reverse id: `about-headless`
- language: `CMS_CONTENT_LANGUAGE`
- template: `about/cms/about_editor.html`
- public access enabled
- navigation disabled

If the configured reverse ID and the About slug already belong to different
pages, the command stops without modifying either page. An administrator must
reconcile that ambiguous duplicate before startup can continue.

## Supported plugins

The `content` placeholder accepts only:

1. `AboutHeroPlugin`
2. `AboutRichTextPlugin`
3. `AboutHistoryPlugin`
4. `AboutFoundersPlugin`
5. `AboutValuesPlugin`
6. `AboutGoalsPlugin`
7. `AboutGalleryPlugin`
8. `AboutVideoPlugin`

The Hero plugin is limited to one instance. Unknown plugin types are ignored by
Next.js so future CMS extensions do not break the page. An entirely unsupported
or empty payload falls back to the current AboutPage API.

## Security

- Rich Text HTML is sanitized in the backend using `nh3` before serialization.
- Frontend links, media URLs, and video URLs are restricted to HTTP/HTTPS.
- Video iframes are generated only for YouTube, Vimeo, and Aparat.
- The django CMS HTML catch-all is intentionally not mounted; public CMS content
  is available only through the REST API.

## Test commands

Backend:

```bash
cd backend
python manage.py test apps.about --settings=config.settings.test
```

Frontend unit/contract tests:

```bash
cd frontend
npm run test:about:unit
```

Frontend fallback/rendering E2E tests:

```bash
cd frontend
npx playwright install chromium
npm run test:about:e2e
```

All About frontend tests:

```bash
npm run test:about
```
