import type { Metadata } from "next";
import { UnitOverview } from "@/components/units/unit-overview";
import { resolveSiteUrl } from "@/lib/site-url";
import { getPublicUnit } from "@/services/public-content-service";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const unit = await getPublicUnit(decodeURIComponent(slug)).catch(() => null);
  const title = unit?.title || "واحد آموزشی";
  const description = unit?.subtitle || unit?.description || undefined;
  return {
    title: `${title} | مجتمع آموزشی بعثت`,
    description,
    alternates: { canonical: `${resolveSiteUrl()}/units/${encodeURIComponent(slug)}` },
    openGraph: {
      title: `${title} | مجتمع آموزشی بعثت`,
      description,
      url: `${resolveSiteUrl()}/units/${encodeURIComponent(slug)}`,
      type: "website",
    },
  };
}

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnitOverview slug={slug} />;
}
