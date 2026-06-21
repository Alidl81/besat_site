import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "گالری تصاویر | مدرسه بعثت",
};

export default function GalleryPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="گالری"
        title="گالری تصاویر"
        description="تصاویر مربوط به برنامه‌ها، رویدادها و فضای مدرسه در این بخش نمایش داده می‌شود."
      />

      <PageSection>
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[4/3] rounded-3xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
      </PageSection>
    </PublicPageLayout>
  );
}
