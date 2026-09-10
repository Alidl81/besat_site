# `force-dynamic` Audit

Per instruction: audit every `export const dynamic = "force-dynamic"` in the
frontend, keep it only where genuinely required by real per-request/
per-session server-side behavior, and never use it merely to dodge the
Phase 0 build failure (see `PHASE0_BUILD_BLOCKER.md` — none of these fixed
that bug; the bug reproduces even on a fully-minimized static page).

14 files currently set it. All 14 reviewed below; **all 14 kept** — each has
an independent, correct justification unrelated to the build bug.

| Route | Justification | Independently correct? |
|---|---|---|
| `app/dashboard/layout.tsx` | Every `/dashboard/*` page is a per-user, authenticated panel view (GM, content manager, unit manager, parent). Serving one cached static HTML page for these would leak one user's rendered shell/data path to another. | **Yes.** Dashboards must never be static regardless of any bug. |
| `app/login/page.tsx` | Reads/writes client-side auth-session state; must reflect current request, not a cached shared page. | **Yes.** |
| `app/set-password/page.tsx` | Reads a per-request, single-use `?token=` query param server-side (`searchParams` page prop) and renders different content per token. Cannot be a single shared static page by definition. | **Yes.** |
| `app/registration/page.tsx` | Reads a per-request `?unit=` query param server-side to preselect the registration form. Same reasoning as set-password. | **Yes.** |
| `app/not-found.tsx` | Rendered per-request for whatever unmatched URL was actually visited; not meaningful to prerender as one static asset. | **Yes.** (Also: 404 pages are commonly excluded from static generation as a matter of course.) |
| `app/shop/cart/page.tsx` | Per-session cart state (cookie/localStorage-backed cart identity resolved server-side via the BFF). | **Yes.** |
| `app/shop/checkout/page.tsx` | Per-session cart + checkout state; `robots: noindex` already present, confirming this was never intended to be a public cacheable page. | **Yes.** |
| `app/shop/register/page.tsx` | Account-creation form; per-request, not cacheable content. | **Yes.** |
| `app/shop/orders/[orderNumber]/page.tsx` | Per-user order detail — one user's order must never be served from a cache shared with another user's request for a different (or the same) order number. | **Yes.** |
| `app/shop/payment/mock/[attemptId]/page.tsx` | Per-payment-attempt state; `robots: noindex` already present. | **Yes.** |
| `app/media/layout.tsx` | Every page under it is a bare `redirect()` shim to `/dashboard/content-manager/*` — no content to cache at all. | **Yes.** |
| `app/unit-manager/layout.tsx` | Same as above — redirect-only shims. | **Yes.** |
| `app/api/customer-registration/route.ts` | Route Handler that accepts a `POST` and mutates backend state — Route Handlers performing mutations must never be statically cached. Pre-existing (not touched this session; confirmed via `git diff` showing no change). | **Yes.** |
| `app/api/backend/[...path]/route.ts` | The BFF proxy itself — every request must reach the live backend per-request; this is the single most important route in the app to never accidentally cache. Pre-existing (not touched this session). | **Yes.** |

## What was explicitly *not* kept

A prior diagnostic pass in this session's build-blocker investigation
temporarily added `export const dynamic = "force-dynamic"` to
`app/page.tsx` (the homepage) and to `app/gallery` was about to receive the
same treatment before the pattern was recognized as non-convergent (see
`PHASE0_BUILD_BLOCKER.md`, "decisive finding"). **The homepage's
`force-dynamic` was reverted** — it is genuinely public, cacheable,
SEO-relevant content, and keeping it dynamic would have been exactly the
"build-error suppression mechanism" the governing instructions forbid,
while not even fixing the underlying bug (proven: `/gallery`, a page never
touched, failed in the very next build run regardless).

## Conclusion

Every current `force-dynamic` in the tree is independently justified by
real per-request/per-user server-side behavior. None exist because of, or
to work around, the Phase 0 build defect. No further changes made.
