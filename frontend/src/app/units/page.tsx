import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { UnitsExplorerSection } from "@/components/circular/units-explorer-section";

export const metadata: Metadata = {
  title: "واحدها | مدرسه بعثت",
};

type UnitsPageProps = {
  searchParams?: Promise<{
    unit?: string | string[];
  }>;
};

function readSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function UnitsPage({ searchParams }: UnitsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const initialUnitSlug = readSingleParam(params?.unit);

  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="واحدها"
        title="واحدهای مدرسه بعثت"
        description="برای مشاهده اطلاعات، اخبار، اطلاعیه‌ها و گالری هر واحد، آن را از گردونه انتخاب کنید."
      />
      <UnitsExplorerSection variant="unit" initialSlug={initialUnitSlug} />
    </PublicPageLayout>
  );
}
