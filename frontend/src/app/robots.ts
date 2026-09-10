import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";

// FE-SEO-PROD-ORIGIN-001: this route has no request-time API, so Next.js
// prerenders it once at build time by default -- and NEXT_PUBLIC_* vars are
// webpack-inlined at that same build step, before the production Docker
// image's runtime env_file is ever applied. Forcing dynamic rendering plus
// resolving the origin fresh per request (via resolveSiteUrl(), called
// inside the function body rather than at module scope, so a
// misconfiguration fails this specific request rather than at import time)
// makes this resolve the real deployment origin on every request instead of
// baking in whatever was set (or unset) inside the build container.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/admin/",
        "/api/",
        "/shop/cart",
        "/shop/checkout",
        "/shop/orders/",
        "/shop/payment/",
        "/set-password",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
