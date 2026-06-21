import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { EmptyState } from "@/components/page/empty-state";
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
        description="خبرها و اطلاعیه‌های مدرسه بعثت در این صفحه منتشر می‌شوند."
      />

      <PageSection>
        <EmptyState title="خبری برای نمایش ثبت نشده است." />
      </PageSection>
    </PublicPageLayout>
  );
}
