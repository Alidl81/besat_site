import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { NewsHub } from "@/components/news/news-hub";

export const metadata: Metadata = {
  title: "اخبار | مدرسه بعثت",
};

export default function NewsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="اخبار"
        title="اخبار مدرسه بعثت"
        description="آخرین اخبار واحدهای آموزشی مجتمع بعثت را یک‌جا دنبال کنید."
      />

      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* NewsHub uses useSearchParams(), which requires a Suspense
              boundary in the App Router -- NewsHub already renders its own
              loading skeleton once mounted, so no fallback UI is needed
              here beyond satisfying that requirement. */}
          <Suspense fallback={null}>
            <NewsHub />
          </Suspense>
        </div>
      </section>
    </PublicPageLayout>
  );
}
