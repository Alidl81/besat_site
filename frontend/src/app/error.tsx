"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export default function GlobalError({
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

  // Same synchronous ref guard as the sibling shop/[slug]/error.tsx --
  // `isRetrying` (state) only reflects a click once React re-renders, so a
  // second click landing before that happens would still read the
  // pre-click `false`. See that file's comment for the full reasoning.
  useEffect(() => {
    if (!isRetrying) retryingRef.current = false;
  }, [isRetrying]);

  // REL-FE-BACKEND-TIMEOUT-001-R4: same fix as shop/[slug]/error.tsx --
  // `reset()` alone re-renders this boundary's children, but for an error
  // thrown during a Server Component's initial render, that does not
  // reliably issue a fresh server request (a live probe confirmed a click
  // on this button emitted no RSC/document request at all for the sibling
  // boundary). `router.refresh()` explicitly invalidates the Router Cache
  // for the current route first, so a genuinely recovered upstream shows
  // the page on the first click instead of only after a manual reload.
  //
  // REL-FE-BACKEND-TIMEOUT-RETRY-DOUBLE-REFRESH-001: same double-click
  // guard as the sibling boundary -- two same-turn clicks fired two
  // redundant RSC refreshes there.
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
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-black text-[#0a2848]">مشکلی در نمایش این صفحه پیش آمد</h1>
        <p className="mt-3 max-w-md text-sm font-bold leading-8 text-[#0a2848]/70">
          می‌توانید دوباره تلاش کنید یا به صفحه نخست بازگردید.
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={isRetrying}
          className="besat-accent-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          بارگذاری مجدد
        </button>
      </Container>
    </PublicPageLayout>
  );
}
