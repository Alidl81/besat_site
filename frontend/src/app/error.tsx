"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PublicPageLayout>
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-black text-[#0a2848]">مشکلی در نمایش این صفحه پیش آمد</h1>
        <p className="mt-3 max-w-md text-sm font-bold leading-8 text-[#0a2848]/60">
          می‌توانید دوباره تلاش کنید یا به صفحه نخست بازگردید.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="besat-accent-button mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          بارگذاری مجدد
        </button>
      </Container>
    </PublicPageLayout>
  );
}
