import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { getShopCategories, getShopProducts } from "@/services/shop-service";
import {
  getPublicAchievements,
  getPublicNews,
  getPublicUnits,
} from "@/services/public-content-service";

// FE-SEO-PROD-ORIGIN-001: see the identical reasoning in robots.ts -- this
// route also has no request-time API by itself, so it would otherwise be
// prerendered once at build time with whatever NEXT_PUBLIC_SITE_URL was (or
// wasn't) set inside the build container, before the production image's
// runtime env_file is ever applied. resolveSiteUrl() is called inside the
// function body (per request), not at module scope, so a misconfiguration
// fails this specific request rather than at import time.
export const dynamic = "force-dynamic";

// Static hubs are supplemented below with the published detail families. The
// API remains the source of truth for publication state, so unpublished,
// inactive, and internal fixture records never become crawlable URLs.
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

  const [categories, products, news, achievements, units] = await Promise.all([
    getShopCategories().catch(() => []),
    getShopProducts({ page_size: 100 })
      .then((response) => response.results)
      .catch(() => []),
    getPublicNews({ page_size: 100 }).then((response) => response.results).catch(() => []),
    getPublicAchievements({ page_size: 100 }).then((response) => response.results).catch(() => []),
    getPublicUnits().catch(() => []),
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

  const newsEntries = news.map((item) => ({
    url: `${siteUrl}/news/${encodeURIComponent(item.slug)}`,
    changeFrequency: "weekly" as const,
    priority: 0.75,
    lastModified: item.published_at,
  }));
  const achievementEntries = achievements.map((item) => ({
    url: `${siteUrl}/achievements/${encodeURIComponent(item.slug)}`,
    changeFrequency: "monthly" as const,
    priority: 0.65,
    lastModified: item.achievement_date || item.achieved_at || undefined,
  }));
  const unitEntries = units.map((unit) => ({
    url: `${siteUrl}/units/${encodeURIComponent(unit.slug)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [
    ...staticEntries,
    ...categoryEntries,
    ...productEntries,
    ...newsEntries,
    ...achievementEntries,
    ...unitEntries,
  ];
}
