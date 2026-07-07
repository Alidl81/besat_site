import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { NewsListContent } from "@/components/content/news-list-content";

export const metadata: Metadata = {
  title: "اخبار | مدرسه بعثت",
};

export default function NewsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="اخبار"
        title="اخبار مدرسه بعثت"
        description="آخرین خبرهای منتشرشده مدرسه در این بخش نمایش داده می‌شود."
      />

      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <NewsListContent />
        </div>
      </section>
    </PublicPageLayout>
  );
}