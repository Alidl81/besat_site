import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { UnitsExplorerSection } from "@/components/circular/units-explorer-section";

export const metadata: Metadata = {
  title: "دپارتمان‌ها | مدرسه بعثت",
};

export default function DepartmentsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="دپارتمان‌ها"
        title="دپارتمان‌های مدرسه بعثت"
        description="حوزه‌های آموزشی و مهارتی بعثت را در یک نمای روشن و قابل انتخاب ببینید."
      />
      <UnitsExplorerSection variant="department" />
    </PublicPageLayout>
  );
}
