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
    tab?: string | string[];
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
  const initialTab = readSingleParam(params?.tab);

  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="واحدها"
        title="واحدهای آموزشی"
        description="واحدهای آموزشی را بر اساس جنسیت و مقطع ببینید و برای معرفی کامل انتخاب کنید."
      />
      <UnitsExplorerSection variant="unit" initialSlug={initialUnitSlug} initialTab={initialTab} />
    </PublicPageLayout>
  );
}
