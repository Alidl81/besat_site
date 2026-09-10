import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { NewsDetailContent } from "@/components/content/news-detail-content";
import { getPublicNewsDetail } from "@/services/public-content-service";
import { resolveSiteUrl } from "@/lib/site-url";
import { isSafeRelativePath } from "@/lib/url-safety";
import { safePublicMediaUrl } from "@/lib/media/safe-url";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

// FE-SEO-NEWS-ORIGIN-001 (residual, same fix as shop/[slug]/page.tsx's
// resolveMetadataImage()): og_image_url/cover_image can be a relative
// "/media/..." path (would otherwise resolve against the root layout's
// build-time-baked metadataBase instead of the real runtime origin), or an
// absolute URL the backend built with the wrong Host
// (FE-PUBLIC-MEDIA-ORIGIN-001) that every visible <img> sink already
// normalizes via safePublicMediaUrl() -- this metadata path bypassed that
// entirely. og:image needs an absolute URL (no document base URL context
// for a <meta> tag), so a relative normalized result still gets the site
// origin prepended.
function resolveOgImage(siteUrl: string, value: string | undefined): string | undefined {
  const safe = safePublicMediaUrl(value);
  if (!safe) return undefined;
  return isSafeRelativePath(safe) ? `${siteUrl}${safe}` : safe;
}

export async function generateMetadata({
  params,
}: NewsDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  const item = await getPublicNewsDetail(slug).catch(() => null);
  if (!item) {
    return { title: "خبر | مدرسه بعثت" };
  }

  const siteUrl = resolveSiteUrl();
  const seo = item.seo;
  const title = seo?.seo_title || item.title;
  const description = seo?.meta_description || item.summary || undefined;
  const ogImage = resolveOgImage(siteUrl, seo?.og_image_url || item.cover_image || undefined);

  return {
    title: `${title} | مدرسه بعثت`,
    description,
    // seo.canonical_url is a Django URLField (validated as an absolute
    // URL by the backend), so only the fallback needs building manually.
    alternates: { canonical: seo?.canonical_url || `${siteUrl}/news/${slug}` },
    robots: {
      index: seo?.is_indexable ?? true,
      follow: seo?.is_followable ?? true,
    },
    openGraph: {
      title: seo?.og_title || title,
      description: seo?.og_description || description,
      images: ogImage ? [ogImage] : undefined,
      url: `${siteUrl}/news/${slug}`,
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