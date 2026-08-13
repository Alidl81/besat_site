import type { MetadataRoute } from "next";
import { getShopCategories, getShopProducts } from "@/services/shop-service";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://besat.example.com").replace(/\/$/, "");

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
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
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
    url: `${SITE_URL}/shop?category=${encodeURIComponent(category.slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/shop/${encodeURIComponent(product.slug)}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
