# Besat frontend

This is the canonical frontend contract for the Besat site. It describes the
current Next.js application in this checkout; older frontend notes under the
repository are historical and are not release instructions.

## Release position

The owner-requested UI pass is complete locally. The frontend is suitable for
staging review, not a claim of production capacity by itself. The final local
checks are:

| Check | Result |
| --- | --- |
| Vitest | 131 test files, 499 tests passed |
| ESLint | passed |
| TypeScript | passed |
| Next production build | passed; 32 static pages generated |
| Browser smoke | passed on a real local Next server |

The full backend and capacity boundary are recorded in [BACKEND.md](./BACKEND.md).

## Runtime and source map

- Framework: Next.js 16.3.0, React, TypeScript, Tailwind CSS, RTL-first
  Persian UI.
- `src/app/` contains route segments and server/client page composition.
- `src/components/` contains shared navigation, circular explorers, contact
  controls, forms, dashboard modules, and visual primitives.
- `src/lib/api/` is the typed browser/server API client boundary.
- `src/lib/server/` contains the BFF client, session cookies, origin guard, and
  signed anonymous identity helper.
- `src/app/api/backend/[...path]/route.ts` is the same-origin BFF. Browser
  requests must use `/api/backend`; they must not call Django directly.
- `public/` contains static brand assets. Uploaded media is rewritten through
  the configured backend media origin.

## Public route surface

The public site routes are:

`/`, `/about`, `/achievements`, `/achievements/[slug]`, `/contact`,
`/departments`, `/gallery`, `/news`, `/news/[slug]`, `/registration`,
`/shop`, `/shop/[slug]`, `/shop/cart`, `/shop/checkout`,
`/shop/orders/[orderNumber]`, `/shop/payment/mock/[attemptId]`,
`/shop/register`, `/units`, and `/virtual-tour`.

The public unit experience is intentionally a single page. `/units` owns the
wheel, selected-unit content, and the `معرفی`, `اخبار`, `افتخارات`, and `گالری`
tabs. Query state is `?unit=<slug>&tab=<key>` and survives refresh/deep links.
The legacy `/units/<slug>`, `/units/<slug>/news`, and
`/units/<slug>/gallery` routes remain as permanent redirects so old bookmarks
and external links resolve without creating a second public page family.

Authentication and account routes are `/login` and `/set-password`. The
server route handlers also expose `/api/session`, `/api/auth-session-empty-tokens`,
`/api/customer-registration`, and the catch-all `/api/backend/[...path]`.

The authenticated UI is grouped by role:

- `/dashboard/admin/*`: general-manager/admin content, users, units, reports,
  shop, staff, students, and virtual tour.
- `/dashboard/content-manager/*`: editorial content, media, news,
  announcements, services, shop products, and review workflows.
- `/dashboard/media/*`: media and publishing review tools.
- `/dashboard/unit-manager/*`: unit-scoped staff, students, content,
  announcements, messages, and profile.
- `/dashboard/parents/*` and `/parents/*`: parent children, programs,
  registration, messages, and shop orders/addresses.
- Legacy-compatible `/admin/*`, `/cms/*`, `/media/*`, and `/unit-manager/*`
  routes remain in the source tree and are protected by the same session and
  role checks; they are not a second API or data store.

## Owner UI fixes

### Department and unit wheels

`CircularSelector` is the shared orbital primitive used by both
`/departments` and `/units` through `CircularExplorer`.

- The wheel stays square at every viewport; it never falls back to a plain
  mobile list.
- Departments use adaptive rounded nodes. Units use a denser treatment with
  distant nodes reduced in opacity/scale so a large public set remains
  legible.
- Data comes from the public API. The internal development unit is excluded
  before rendering.
- The historical Besat motion is preserved: pointer drag uses the direct
  start-angle delta, mouse/touch/pen input is supported, and release snaps to
  the nearest item with the original shortest-path 900ms cubic easing. There
  is no idle spin or synthetic inertia.
- Wheel scrolling over the center selects the adjacent item. Arrow keys,
  Home, and End provide a keyboard path.
- Labels counter-rotate so they remain upright while the orbit rotates.
- `prefers-reduced-motion: reduce` removes the orbit transition while
  preserving selection and keyboard behavior.
- The active node is a real button with `aria-pressed`; the wheel container is
  labelled `گردونه انتخاب حوزه` or `گردونه انتخاب واحد آموزشی`.
- The detail card below the wheel exposes the selected department/unit action;
  selection is not dependent on hover.

### Contact unit mini-carousel

`ContactUnitSelector` is rendered directly beneath the central contact card in
the right column. It is intentionally separate from the contact form.

- It is a compact image-free selector: the selected unit is a rounded
  rectangle in the center, with exactly one circular previous-unit control on
  the left and one circular next-unit control on the right.
- The active card itself contains the selected unit's phone, email, short
  address/descriptor, and `/units?unit=<slug>` CTA. Details are never repeated
  in a second lower panel, so the card has no clipped or empty lower region.
- Previous/next buttons have the accessible labels `واحد قبلی` and `واحد بعدی`.
- The tablist supports clicking either circular neighbor, pointer/touch drag,
  ArrowLeft/ArrowRight, Home, and End. Dragging beyond the threshold suppresses
  only the accidental click caused by that drag.
- On narrow screens the order is central contact card, mini carousel, then
  the unchanged contact form. On desktop the form remains in its existing
  column and the card/carousel remain together in the other column.

### Footer and public links

- The footer contains only the current CMS-provided social links and internal
  quick links. The legacy `besat-r.com`, `besat-hs.ir`, and `besatkids.com`
  destinations are not rendered.
- Telegram and Eitaa use the existing local assets at
  `public/icons/social/telegram.svg` and `public/icons/social/eitaa.svg`, with
  accessible service labels and responsive wrapping at phone widths.

### Shared mobile navigation

`SiteHeader` is the single source for desktop and mobile navigation. The mobile
drawer includes the same `واحدهای آموزشی` and `دپارتمان‌های تخصصی` links as
the desktop header, preserves the active route, and supports:

- hamburger open and close controls;
- Escape to close;
- focus restoration to the opener;
- focus containment while open;
- body scroll locking;
- outside/close-button dismissal without a pathname race.

## Responsive acceptance evidence

Real screenshots captured from the local running site are retained under
`.audit/final-public-ui-correction/screens/`:

- `departments-{360,390,768,1024,1366,1440}.png`
- `units-{360,390,768,1024,1366,1440}.png`
- `contact-{360,390,768,1024,1366,1440}.png`
- `mobile-menu-{360,390}.png`

The 360 and 390 captures show the same orbital wheels rather than a list, no
horizontal overflow, readable labels, the compact active contact card, and the
mobile drawer branches. Desktop captures show the two-column contact layout
and the selected card with side neighbors directly under the central contact
card. Unit deep-link and legacy-route redirect evidence is kept beside the
screenshots in the same ignored audit folder.

The browser interaction smoke additionally performed real pointer drags on a
department wheel and a unit wheel, performed a Contact selector swipe after
scrolling the carousel into view, verified selected-node changes, opened the
mobile drawer, and verified both requested navigation branches. It used only
the local Next server and seeded local data.

## Data and BFF boundary

The browser's public base is always `/api/backend`. The BFF:

1. validates same-origin mutations (including trusted forwarded-proto rules);
2. forwards cookies and safe request headers to Django;
3. strips an inbound anonymous identity header so callers cannot spoof it;
4. creates/reads the `besat_anon_id` HttpOnly, SameSite=Lax cookie;
5. signs the browser identity with `BESAT_ANON_THROTTLE_SECRET` and forwards
   only the signed value;
6. copies safe response headers and sets a new identity cookie when needed.

In production, a missing anonymous-throttle secret is a configuration error,
not a reason to silently collapse all visitors into one backend throttle bucket.
The cookie is not an authentication credential and carries no profile data.

## Environment contract

Required or supported variables are:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Browser same-origin API path; normally `/api/backend`. |
| `NEXT_PUBLIC_SITE_URL` | Build-time public origin for metadata and absolute links. |
| `SITE_URL` | Runtime origin for request-time robots/sitemap and URL helpers. |
| `BESAT_BACKEND_API_URL` | Server-side Django base URL and media rewrite source. |
| `NEXT_SERVER_API_BASE_URL` | Server-side API base fallback. |
| `BESAT_ANON_THROTTLE_SECRET` | Long random value shared with Django; never public. |
| `BESAT_TRUST_FORWARDED_FOR` | `true` only behind a proxy that overwrites forwarded headers. |
| `NODE_ENV` | Next runtime mode. |
| `WATCHPACK_POLLING` | Local container development only. |
| `BESAT_MOCK_DB_PATH` | Test-only mock store override; not a production data source. |
| `BESAT_TEST_HANDLE_DUMP` | Test-only open-handle diagnostics. |

`NEXT_PUBLIC_SITE_URL` and the media rewrite source are evaluated during the
Next image build. In a production compose build, export the same real values
that will be supplied at runtime; the production example and Dockerfile reject
loopback-shaped backend URLs.

## Verification commands

From `frontend/`:

```text
npm test -- --run
npm run lint
npm run typecheck
npm run build
```

For a browser smoke, start a local Next server, open the public routes at the
target viewport sizes, and retain screenshots under `.audit/`. Do not use a
static screenshot as a substitute for pointer, keyboard, or server/API
verification.

## Known frontend follow-ups

- Production load is a backend/deployment question; the local capacity result
  is `NOT_READY_FOR_3000_CONCURRENT` and is documented in `BACKEND.md`.
- The OpenAPI schema has backend warnings/errors even though the frontend
  client and runtime tests pass. Add explicit serializers and stable component
  names before treating generated client code as a hard contract.
- Do not put a real secret in `.env*` files or screenshots. Use the ignored
  deployment environment and rotate it as an operational secret.
