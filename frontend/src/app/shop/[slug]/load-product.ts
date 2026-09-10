import { getShopProduct } from "@/services/shop-service";
import { ApiError } from "@/lib/api/client";

// FE-SHOP-ERROR-MASKING-001: `.catch(() => null)` collapsed every failure
// mode -- a genuine 404, a 429 rate-limit, a 500, a network error -- into
// the same "product not found" outcome, so a transient throttle response
// rendered as a permanent, misleading 404 page. Only a real backend 404
// means the product doesn't exist; anything else needs to reach the
// nearest error.tsx boundary (which already offers a proper retry action)
// instead of lying to the user about the product's existence.
//
// Kept in its own module rather than inline in page.tsx: Next.js's
// generated route types reject any page.tsx export other than its
// recognized special exports (default, metadata, generateMetadata,
// dynamic, ...), so a plain helper needed for both the page and a unit
// test can't live there directly.
//
// REL-FE-BACKEND-TIMEOUT-001-R1: `generateMetadata()` and the page
// component each called this independently. React's `cache()` (the first
// attempt here) memoizes by argument identity within a single render's
// request-scoped cache -- but empirical instrumentation (a QA-only build
// with `console.error` timing around this function, since neither pass
// is otherwise observable) showed THREE separate `loadProduct()`
// invocations per request, not two: the first two arrive ~8ms apart
// (`generateMetadata()` and the page component, genuinely concurrent),
// but a third arrives ~13ms after the first two *settle* -- consistent
// with Next re-attempting metadata resolution once after the first
// attempt fails, independent of whatever caching mechanism is used.
// `cache()`'s per-request scope, and an in-flight-only map that evicts
// the instant a call settles, both dedupe the first pair but miss this
// near-immediate third call, so the upstream still saw two full 8s
// timeouts serially (confirmed against `.agents/qa/frontend/
// backend-timeout-smoke.md`'s "Current-source retest": 14.868s for
// exactly two duplicate GETs).
//
// The fix keeps a settled result (success OR failure) around for a short
// grace window after it settles, instead of evicting immediately, so a
// near-immediate repeat call for the same slug reuses that result rather
// than re-issuing the request. `GRACE_MS` is chosen with wide margin over
// the ~13ms retry gap actually observed, while staying short enough that
// it never functions as a real data cache -- a genuinely new page view
// for the same slug more than a few seconds later still fetches fresh
// data. During a real backend outage this also has the desirable side
// effect of a short negative-cache: concurrent visitors hitting the same
// failing slug within the grace window fail fast together instead of
// each independently waiting out a full 8s timeout.
const GRACE_MS = 3_000;

// REL-FE-BACKEND-TIMEOUT-001-R4: error.tsx's retry button calls
// router.refresh() to force page.tsx's Server Component to re-run, which
// calls loadProduct() again -- but a live probe found that clicking retry
// almost immediately (~430ms) after the error appeared reused this exact
// grace-window cache and got the SAME stale rejected promise back with no
// new upstream request at all, because 430ms is still well inside the 3s
// `GRACE_MS` window meant for the internal ~13ms near-duplicate-calls
// case above. A genuinely new page view for a slug that's still failing
// needs the same short race protection (so THIS request's own two-to-
// three near-simultaneous internal calls still collapse into one), but a
// deliberate user retry -- which by construction can only ever happen
// after the first attempt has already visibly failed and the button has
// rendered, an order of magnitude slower than 13ms -- must not be
// swallowed by it. Only a *rejected* settled result gets this much
// shorter grace window; a successful one keeps the full GRACE_MS, since
// there's no retry button to race against a fast repeat view of a
// product that already loaded fine.
const FAILURE_GRACE_MS = 200;

async function fetchProduct(slug: string) {
  try {
    return await getShopProduct(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

const settledBySlug = new Map<string, ReturnType<typeof fetchProduct>>();

export function loadProduct(slug: string) {
  const existing = settledBySlug.get(slug);
  if (existing) return existing;

  const promise = fetchProduct(slug);
  settledBySlug.set(slug, promise);

  // A single two-argument `.then(onFulfilled, onRejected)` call, not a
  // separate `.then().catch()` chain: attaching a plain `.then(onFulfilled)`
  // with no rejection handler would create its own derived promise that
  // rejects right along with `promise` (since nothing there catches it),
  // becoming a brand new unhandled rejection of its own. Both branches
  // here handle their case without re-throwing, so this single derived
  // promise always resolves and simultaneously consumes `promise`'s own
  // rejection, exactly like the previous single-chain version did.
  promise.then(
    () => armEviction(slug, promise, GRACE_MS),
    () => {
      // A rejection gets the much shorter FAILURE_GRACE_MS window instead
      // -- see that constant's comment for why a fast user-initiated
      // retry must not reuse a stale rejected result.
      armEviction(slug, promise, FAILURE_GRACE_MS);
    },
  );

  return promise;
}

function armEviction(slug: string, promise: ReturnType<typeof fetchProduct>, delayMs: number) {
  const timer = setTimeout(() => {
    // Only evict if this exact promise is still the current entry -- a
    // retry that already replaced it with a fresh call must not have its
    // own, still-pending entry clobbered by this older timer firing late.
    if (settledBySlug.get(slug) === promise) settledBySlug.delete(slug);
  }, delayMs);
  // Node-only: don't let this timer keep the process (or a test run)
  // alive on its own.
  timer.unref?.();
}
