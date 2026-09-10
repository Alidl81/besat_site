"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

// REL-FE-BACKEND-TIMEOUT-001-R1: a non-404 `loadProduct()` failure (a
// timeout, a 429, a 500) previously had no scoped boundary here, so it
// fell through to the root app/error.tsx -- rendered as a full-page,
// generic "something went wrong" shell with no indication this was a
// single product page, not the whole site. Next.js renders the *nearest*
// error.tsx to the segment that threw, so this file alone (with no
// change to the root boundary) localizes the retry to the product page.
export default function ShopProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isRetrying, startRetryTransition] = useTransition();
  const retryingRef = useRef(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  // `isRetrying` (React state) only reflects the click that caused it once
  // React actually re-renders -- two clicks landing in the same
  // synchronous stack frame (no render in between) would both still read
  // the pre-click `false`. `retryingRef` is written immediately,
  // synchronously, the instant the first click's handler runs, so it
  // blocks a second click regardless of render timing; the effect below
  // releases it again once `isRetrying` itself confirms the transition
  // has actually settled, so a later deliberate retry (after a repeat
  // failure) is never permanently blocked.
  useEffect(() => {
    if (!isRetrying) retryingRef.current = false;
  }, [isRetrying]);

  // REL-FE-BACKEND-TIMEOUT-001-R4: `reset()` alone re-renders this
  // boundary's children, but `loadProduct()` throws inside an async
  // Server Component (page.tsx) -- a live probe confirmed clicking
  // "تلاش دوباره" and waiting 10s emitted no RSC/document request at all,
  // so the boundary just sat there unchanged; only an actual full page
  // reload re-ran the server component and recovered. `router.refresh()`
  // explicitly invalidates the Router Cache for this route and issues a
  // fresh server request -- reset() alone does not reliably do that for
  // an error thrown during the initial server render. Calling both means
  // a genuinely recovered upstream now shows the product on the very
  // first click, not just after a manual reload.
  //
  // REL-FE-BACKEND-TIMEOUT-RETRY-DOUBLE-REFRESH-001: two same-turn clicks
  // (the upstream fetch itself is already single-flighted by
  // load-product.ts's own settledBySlug map, but the RSC refresh request
  // this button triggers was not) produced two identical, redundant RSC
  // refreshes. `retryingRef` blocks a second click synchronously; wrapping
  // the actual work in `startTransition()` also disables the button (via
  // `isRetrying`) as a visible, real-time reflection of the in-flight
  // state for the rest of its duration.
  function retry() {
    if (retryingRef.current) return;
    retryingRef.current = true;
    startRetryTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <PublicPageLayout>
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <h1 role="alert" className="text-2xl font-black text-[#0a2848]">
          نمایش این محصول با مشکل مواجه شد
        </h1>
        <p className="mt-3 max-w-md text-sm font-bold leading-8 text-[#0a2848]/70">
          ممکن است اتصال به سرور موقتاً قطع شده باشد. می‌توانید دوباره تلاش کنید یا به فروشگاه بازگردید.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            className="besat-accent-button inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-xl border border-[#0a2848]/15 px-6 py-3 text-sm font-black text-[#0a2848]"
          >
            بازگشت به فروشگاه
          </Link>
        </div>
      </Container>
    </PublicPageLayout>
  );
}
