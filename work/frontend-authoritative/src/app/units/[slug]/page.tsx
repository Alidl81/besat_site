import type { Metadata } from "next";
import { UnitOverview } from "@/components/units/unit-overview";

export const metadata: Metadata = {
  title: "واحد آموزشی | مجتمع آموزشی بعثت",
};

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnitOverview slug={slug} />;
}

