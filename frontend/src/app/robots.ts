import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://besat.example.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
