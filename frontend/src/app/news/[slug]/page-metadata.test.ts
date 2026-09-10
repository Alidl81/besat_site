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

vi.mock("@/services/public-content-service", () => ({ getPublicNewsDetail: vi.fn() }));

import { getPublicNewsDetail } from "@/services/public-content-service";
import { generateMetadata } from "./page";

const baseNewsItem = {
  id: 1,
  title: "خبر آزمایشی",
  slug: "test-news",
  summary: "خلاصه",
  cover_image: "http://localhost:3000/media/news/cover.jpg",
  published_at: "2026-08-30T00:00:00Z",
  category: null,
  seo: undefined,
};

// FE-SEO-NEWS-ORIGIN-001 (residual, same defect as the shop product page):
// og:image bypassed safePublicMediaUrl() entirely, so a backend-built
// absolute "/media/..." URL with the wrong Host (FE-PUBLIC-MEDIA-ORIGIN-001)
// leaked straight into page metadata.
describe("news detail page generateMetadata media-origin normalization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes a wrong-origin absolute /media/ cover_image in og:image", async () => {
    vi.stubEnv("SITE_URL", "https://besat.org");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.org");
    (getPublicNewsDetail as ReturnType<typeof vi.fn>).mockResolvedValue(baseNewsItem);

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "test-news" }) });

    expect(metadata.openGraph?.images).toEqual(["https://besat.org/media/news/cover.jpg"]);
  });

  it("still renders no og:image when the news item has none", async () => {
    vi.stubEnv("SITE_URL", "https://besat.org");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.org");
    (getPublicNewsDetail as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseNewsItem, cover_image: null });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "test-news" }) });

    expect(metadata.openGraph?.images).toBeUndefined();
  });
});
