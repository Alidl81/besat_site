import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "اخبار و اطلاعیه‌ها | مدرسه بعثت",
};

export default function NewsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="اخبار"
        title="اخبار و اطلاعیه‌ها"
        description="در این صفحه، خبرها و اطلاعیه‌های مدرسه بعثت نمایش داده می‌شود."
      />

      <PageSection>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-xl font-bold text-slate-950">اخبار مدرسه</h2>
          <p className="mt-4 leading-8 text-slate-600">
            در حال حاضر خبری برای نمایش وجود ندارد.
          </p>
        </div>
      </PageSection>
    </PublicPageLayout>
  );
}
