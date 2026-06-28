import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { UnitsExplorerSection } from "@/components/circular/units-explorer-section";

export const metadata: Metadata = {
  title: "واحدها | مدرسه بعثت",
};

export default function UnitsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="واحدها"
        title="واحدهای مدرسه بعثت"
        description="برای مشاهده اطلاعات، اخبار، اطلاعیه‌ها و گالری هر واحد، آن را از گردونه انتخاب کنید."
      />
      <UnitsExplorerSection variant="unit" />
    </PublicPageLayout>
  );
}
