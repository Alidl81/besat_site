import type { Metadata } from "next";
import { BookOpen, GraduationCap, MapPin } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { FeaturedStrip } from "@/components/shop/featured-strip";
import { ShopExplorer } from "@/components/shop/shop-explorer";
import { ProductGridSkeleton } from "@/components/shop/skeletons";
import { getShopProducts } from "@/services/shop-service";
import { resolveSiteUrl } from "@/lib/site-url";

// FE-SEO-PAGE-ORIGIN-001: this page has no request-time API, so Next.js
// would otherwise prerender it once at build time -- baking the root
// layout's metadataBase (itself sourced from the build-time-inlined
// NEXT_PUBLIC_SITE_URL) into the canonical link permanently. Forcing
// dynamic rendering and building an absolute canonical directly from
// resolveSiteUrl() (called per-request, ignoring the inherited
// metadataBase entirely -- an absolute URL in a metadata field always
// wins over metadataBase composition) matches the same fix already
// verified for robots.ts/sitemap.ts.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = resolveSiteUrl();
  return {
    title: "فروشگاه | مجتمع آموزشی بعثت",
    description: "کتاب‌های کمک‌درسی، دوره‌های آنلاین و دوره‌های حضوری مجتمع آموزشی بعثت.",
    alternates: { canonical: `${siteUrl}/shop` },
    openGraph: {
      title: "فروشگاه مجتمع آموزشی بعثت",
      description: "کتاب‌های کمک‌درسی، دوره‌های آنلاین و دوره‌های حضوری مجتمع آموزشی بعثت.",
      url: `${siteUrl}/shop`,
      type: "website",
    },
  };
}

const typeShortcuts = [
  { label: "کتاب و کالا", type: "physical", icon: BookOpen },
  { label: "دوره‌های آنلاین", type: "online_course", icon: GraduationCap },
  { label: "دوره‌های حضوری", type: "in_person_course", icon: MapPin },
];

export default async function ShopPage() {
  const featured = await getShopProducts({ featured: true, page_size: 8 }).catch(() => null);

  return (
    <PublicPageLayout>
      <header className="border-b border-[#e5e7eb] bg-white">
        <Container className="py-8 md:py-10">
          <p className="mb-2 text-sm font-black text-[#8a641f]">فروشگاه بعثت</p>
          <h1 className="max-w-2xl text-2xl font-black leading-[1.5] text-[#0a2848] md:text-4xl">
            کتاب، دوره آنلاین و دوره حضوری مجتمع آموزشی بعثت
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-8 text-[#0a2848]/70 md:text-base">
            محصولات آموزشی مجتمع بعثت را مرور و خریداری کنید.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {typeShortcuts.map(({ label, type, icon: Icon }) => (
              <Link
                key={type}
                href={`/shop?type=${type}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fbfaf7] px-4 py-2 text-xs font-black text-[#0a2848] transition hover:border-[#c98c3d] hover:bg-[#fbf3e7]"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            ))}
          </div>
        </Container>
      </header>

      <div className="bg-[#fbfaf7] py-8 md:py-10">
        <Container>
          <div className="grid gap-8">
            {featured && featured.results.length > 0 ? (
              <FeaturedStrip products={featured.results} />
            ) : null}
            <Suspense fallback={<ProductGridSkeleton />}>
              <ShopExplorer />
            </Suspense>
          </div>
        </Container>
      </div>
    </PublicPageLayout>
  );
}
