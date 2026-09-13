import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "واحدها | مجتمع آموزشی بعثت",
  alternates: { canonical: "/units" },
  robots: { index: false, follow: true },
};

export default async function UnitNewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/units?unit=${encodeURIComponent(decodeURIComponent(slug))}&tab=news`);
}
