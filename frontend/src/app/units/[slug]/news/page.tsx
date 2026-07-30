import type { Metadata } from "next";
import { UnitContentPage } from "@/components/units/unit-content-page";

export const metadata: Metadata = {
  title: "اخبار واحد | مجتمع آموزشی بعثت",
};

export default async function UnitNewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnitContentPage slug={slug} type="news" />;
}
