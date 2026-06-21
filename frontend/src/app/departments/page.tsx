import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { EmptyState } from "@/components/page/empty-state";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "دپارتمان‌ها | مدرسه بعثت",
};

export default function DepartmentsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="دپارتمان‌ها"
        title="دپارتمان‌های آموزشی"
        description="دپارتمان‌های آموزشی مدرسه بعثت در این بخش معرفی می‌شوند."
      />

      <PageSection>
        <EmptyState title="دپارتمانی برای نمایش ثبت نشده است." />
      </PageSection>
    </PublicPageLayout>
  );
}
