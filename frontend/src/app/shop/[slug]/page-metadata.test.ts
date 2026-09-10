// @vitest-environment node
//
// FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): generateMetadata is a genuine
// Next.js server-only function -- it never runs with a `window` in real
// production, so safe-url.ts's effectiveSiteUrl() correctly falls back to
// NEXT_PUBLIC_SITE_URL there. The project's default jsdom test environment
// would otherwise supply a fake `window` this code never actually has,
// making effectiveSiteUrl() prefer jsdom's own default origin over the
// env var this test stubs -- `node` accurately mirrors the real runtime
// instead of papering over that mismatch with a fake window.location stub.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./load-product", () => ({ loadProduct: vi.fn() }));

import { loadProduct } from "./load-product";
import { generateMetadata } from "./page";

const baseProduct = {
  id: 1,
  product_type: "physical" as const,
  title: "کتاب آزمایشی",
  slug: "test-book",
  short_description: null,
  featured_image: "http://localhost:3000/media/products/book.jpg",
  category: null,
  tags: [],
  price_amount: 100000,
  sale_price_amount: null,
  price_display: null,
  sale_price_display: null,
  is_on_sale: false,
  is_featured: false,
  is_important: false,
  status: "published" as const,
  is_published: true,
  physical_detail: {
    availability: "in_stock" as const,
    weight_grams: null,
    requires_shipping: false,
    max_purchase_quantity: null,
  },
  course_detail: null,
  seo: undefined,
};

// FE-SEO-PAGE-ORIGIN-001 (residual): og:image/twitter:image and the Product
// JSON-LD `image` field bypassed safePublicMediaUrl() entirely, so a
// backend-built absolute "/media/..." URL with the wrong Host
// (FE-PUBLIC-MEDIA-ORIGIN-001) leaked straight into page metadata even
// after every visible <img> sink was fixed.
describe("shop product page generateMetadata media-origin normalization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes a wrong-origin absolute /media/ featured_image in og:image", async () => {
    vi.stubEnv("SITE_URL", "https://besat.org");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.org");
    (loadProduct as ReturnType<typeof vi.fn>).mockResolvedValue(baseProduct);

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "test-book" }) });

    expect(metadata.openGraph?.images).toEqual(["https://besat.org/media/products/book.jpg"]);
  });

  // The Product JSON-LD `image` field (buildStructuredData(), not exported
  // -- Next's route-type generator rejects any page.tsx export other than
  // its recognized special ones, see load-product.ts's own comment on this
  // same constraint) uses the identical resolveMetadataImage(baseUrl,
  // product.featured_image) composition verified above; not independently
  // re-tested here to avoid a fragile full-page-render harness for a
  // one-line call to an already-covered helper.

  it("still renders no og:image when the product has none", async () => {
    vi.stubEnv("SITE_URL", "https://besat.org");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.org");
    (loadProduct as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseProduct, featured_image: null });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "test-book" }) });

    expect(metadata.openGraph?.images).toBeUndefined();
  });
});
