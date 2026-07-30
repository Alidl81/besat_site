import type { Metadata } from "next";
import { UnitContentPage } from "@/components/units/unit-content-page";

export const metadata: Metadata = {
  title: "گالری واحد | مجتمع آموزشی بعثت",
};

export default async function UnitGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnitContentPage slug={slug} type="gallery" />;
}
