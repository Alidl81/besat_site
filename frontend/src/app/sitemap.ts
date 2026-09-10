import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { getShopCategories, getShopProducts } from "@/services/shop-service";

// FE-SEO-PROD-ORIGIN-001: see the identical reasoning in robots.ts -- this
// route also has no request-time API by itself, so it would otherwise be
// prerendered once at build time with whatever NEXT_PUBLIC_SITE_URL was (or
// wasn't) set inside the build container, before the production image's
// runtime env_file is ever applied. resolveSiteUrl() is called inside the
// function body (per request), not at module scope, so a misconfiguration
// fails this specific request rather than at import time.
export const dynamic = "force-dynamic";

// Static, low-churn public routes. This repo has no prior sitemap.ts at
// all -- this file is new infrastructure the shop's own SEO requirement
// needs (a sitemap is inherently site-wide; Next.js only supports one
// canonical /sitemap.xml). Kept intentionally small and static for the
// non-shop section: full dynamic coverage of news/gallery/achievements
// detail pages is a pre-existing gap outside this task's scope, not
// something newly introduced here.
const STATIC_ROUTES = [
  "",
  "/about",
  "/news",
  "/achievements",
  "/gallery",
  "/contact",
  "/units",
  "/departments",
  "/shop",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === "" || path === "/shop" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/shop" ? 0.9 : 0.6,
  }));

  const [categories, products] = await Promise.all([
    getShopCategories().catch(() => []),
    getShopProducts({ page_size: 100 })
      .then((response) => response.results)
      .catch(() => []),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/shop?category=${encodeURIComponent(category.slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/shop/${encodeURIComponent(product.slug)}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
