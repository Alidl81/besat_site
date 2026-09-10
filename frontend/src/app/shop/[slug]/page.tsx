import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { getShopProduct, getShopProducts } from "@/services/shop-service";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { resolveSiteUrl } from "@/lib/site-url";
import { isSafeRelativePath } from "@/lib/url-safety";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { loadProduct } from "./load-product";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

// FE-SEO-PAGE-ORIGIN-001 (residual): og:image/twitter:image and the
// Product JSON-LD `image` field bypassed `safePublicMediaUrl()` entirely,
// so an absolute "/media/..." URL the backend built with the wrong Host
// (FE-PUBLIC-MEDIA-ORIGIN-001) leaked into page metadata even after every
// visible <img> sink was fixed -- crawlers/social previews read these tags
// directly, with no browser-side fallback the way a broken <img> at least
// has next/image's error handling. `safePublicMediaUrl()` both normalizes
// a `/media/` URL to this app's own origin and rejects a genuinely unsafe
// value; metadata fields specifically need an *absolute* URL (there is no
// document base URL context for a <meta> tag the way there is for an
// in-page <img src>), so a relative result still gets the site origin
// prepended here, same as the previous og-image-only helper did.
function resolveMetadataImage(siteUrl: string, value: string | undefined): string | undefined {
  const safe = safePublicMediaUrl(value);
  if (!safe) return undefined;
  return isSafeRelativePath(safe) ? `${siteUrl}${safe}` : safe;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(decodeURIComponent(slug));

  if (!product) {
    return { title: "محصول | فروشگاه بعثت" };
  }

  const siteUrl = resolveSiteUrl();
  const seo = product.seo as { seo_title?: string; meta_description?: string; canonical_url?: string; og_image_url?: string; is_indexable?: boolean; is_followable?: boolean } | undefined;
  const title = seo?.seo_title || product.title;
  const description = seo?.meta_description || product.short_description || undefined;
  const ogImage = resolveMetadataImage(siteUrl, seo?.og_image_url || product.featured_image || undefined);

  return {
    title: `${title} | فروشگاه بعثت`,
    description,
    // seo.canonical_url is a Django URLField (validated as an absolute
    // URL by the backend), so only the fallback needs building manually.
    alternates: { canonical: seo?.canonical_url || `${siteUrl}/shop/${product.slug}` },
    robots: { index: seo?.is_indexable ?? true, follow: seo?.is_followable ?? true },
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      url: `${siteUrl}/shop/${product.slug}`,
      type: "website",
    },
  };
}

function buildStructuredData(product: NonNullable<Awaited<ReturnType<typeof getShopProduct>>>, baseUrl: string) {
  const url = `${baseUrl}/shop/${product.slug}`;
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "فروشگاه", item: `${baseUrl}/shop` },
      { "@type": "ListItem", position: 2, name: product.title, item: url },
    ],
  };

  if (product.product_type === "physical") {
    const price = product.is_on_sale ? product.sale_price_amount : product.price_amount;
    const availability =
      product.physical_detail?.availability === "in_stock" || product.physical_detail?.availability === "low_stock"
        ? "https://schema.org/InStock"
        : product.physical_detail?.availability === "preorder"
          ? "https://schema.org/PreOrder"
          : "https://schema.org/OutOfStock";

    return [
      breadcrumbList,
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description: product.short_description || undefined,
        image: resolveMetadataImage(baseUrl, product.featured_image || undefined),
        url,
        ...(price !== null
          ? {
              offers: {
                "@type": "Offer",
                price: (price / 10).toFixed(0),
                priceCurrency: "IRT",
                availability,
                url,
              },
            }
          : {}),
      },
    ];
  }

  const course = product.course_detail;
  return [
    breadcrumbList,
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: product.title,
      description: product.short_description || undefined,
      provider: { "@type": "Organization", name: "مجتمع آموزشی بعثت", sameAs: baseUrl },
      ...(course?.instructor_name
        ? { instructor: { "@type": "Person", name: course.instructor_name } }
        : {}),
    },
  ];
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await loadProduct(decodeURIComponent(slug));

  if (!product) {
    notFound();
  }

  const related = product.category
    ? await getShopProducts({ category: product.category.slug, page_size: 4 }).catch(() => null)
    : null;
  const relatedProducts = (related?.results ?? []).filter((item) => item.id !== product.id).slice(0, 4);

  const structuredData = buildStructuredData(product, resolveSiteUrl());

  return (
    <PublicPageLayout>
      {structuredData.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(entry) }}
        />
      ))}

      <div className="bg-white">
        <Container className="py-4">
          <nav aria-label="مسیر صفحه" className="flex items-center gap-1.5 text-xs font-bold text-[#0a2848]/70">
            <Link href="/shop" className="hover:text-[#0a2848]">
              فروشگاه
            </Link>
            <ChevronLeft aria-hidden="true" className="size-3.5" />
            <span aria-current="page" className="line-clamp-1 text-[#0a2848]">
              {product.title}
            </span>
          </nav>
        </Container>
      </div>

      <div className="bg-white pb-12">
        <Container className="pt-2">
          <ProductDetailView product={product} />
        </Container>

        {relatedProducts.length > 0 ? (
          <div className="mt-4 border-t border-[#e5e7eb] bg-[#fbfaf7] py-10">
            <Container>
              <h2 className="mb-4 text-base font-black text-[#0a2848]">محصولات مرتبط</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {relatedProducts.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </Container>
          </div>
        ) : null}
      </div>
    </PublicPageLayout>
  );
}
