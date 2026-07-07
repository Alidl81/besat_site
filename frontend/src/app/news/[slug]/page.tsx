import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { NewsDetailContent } from "@/components/content/news-detail-content";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "خبر | مدرسه بعثت",
};

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  return (
    <PublicPageLayout>
      <NewsDetailContent slug={slug} />
    </PublicPageLayout>
  );
}