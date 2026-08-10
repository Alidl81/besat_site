import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { NewsDetailContent } from "@/components/content/news-detail-content";
import { getPublicNewsDetail } from "@/services/public-content-service";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: NewsDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  const item = await getPublicNewsDetail(slug).catch(() => null);
  if (!item) {
    return { title: "خبر | مدرسه بعثت" };
  }

  const seo = item.seo;
  const title = seo?.seo_title || item.title;
  const description = seo?.meta_description || item.summary || undefined;
  const ogImage = seo?.og_image_url || item.cover_image || undefined;

  return {
    title: `${title} | مدرسه بعثت`,
    description,
    alternates: seo?.canonical_url ? { canonical: seo.canonical_url } : { canonical: `/news/${slug}` },
    robots: {
      index: seo?.is_indexable ?? true,
      follow: seo?.is_followable ?? true,
    },
    openGraph: {
      title: seo?.og_title || title,
      description: seo?.og_description || description,
      images: ogImage ? [ogImage] : undefined,
      type: "article",
    },
  };
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  return (
    <PublicPageLayout>
      <NewsDetailContent slug={slug} />
    </PublicPageLayout>
  );
}