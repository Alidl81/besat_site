import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { slidesMock, settingsMock, newsMock } = vi.hoisted(() => ({
  slidesMock: vi.fn(),
  settingsMock: vi.fn(),
  newsMock: vi.fn(),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicHomeSlides: slidesMock,
  getPublicSiteSettings: settingsMock,
  getPublicNews: newsMock,
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/lib/home/hero-visibility-context", () => ({
  useHeroVisibility: () => ({ setHasVisibleHero: vi.fn() }),
}));

import { HomeSliderSection } from "@/components/home/home-slider-section";

// SEC-FE-HOME-SLIDE-MEDIA-001: the CMS slide mapping copied `slide.image`
// (and the `settings.hero_image` fallback) straight into `imageSrc` with
// no sanitization, so a protocol-relative URL or a `data:` URL (the
// backend's `image_url` field is a writable free-text TextField, per its
// own doc comment) reached the hero `<img src>` unchanged. Both are now
// routed through the same `safePublicMediaUrl()` sanitizer already used
// for the featured-news slide path two lines above -- a slide whose image
// fails sanitization is dropped from the slideshow entirely (same pattern
// as newsSlides' existing filter) rather than rendered with an unsafe
// src.
describe("HomeSliderSection CMS image URL boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.mockResolvedValue({ school_name: "بعثت", hero_image: null });
    newsMock.mockResolvedValue({ results: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("drops a protocol-relative CMS slide image instead of rendering it off-origin", async () => {
    slidesMock.mockResolvedValue([
      {
        id: 91,
        title: "اسلاید ناامن",
        subtitle: "زیرعنوان",
        image: "//evil.example/slide.jpg",
        alt_text: "اسلاید",
        href: null,
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(document.querySelectorAll('img[src="//evil.example/slide.jpg"]')).toHaveLength(0);
  });

  it("drops a data: URL CMS slide image instead of rendering it", async () => {
    const dataUrl = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>";
    slidesMock.mockResolvedValue([
      {
        id: 92,
        title: "اسلاید داده‌ای",
        subtitle: "زیرعنوان",
        image: dataUrl,
        alt_text: "اسلاید",
        href: null,
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(document.querySelectorAll(`img[src="${dataUrl}"]`)).toHaveLength(0);
  });

  it("keeps a safe CMS slide while dropping an unsafe one in the same batch", async () => {
    slidesMock.mockResolvedValue([
      {
        id: 93,
        title: "اسلاید امن",
        subtitle: "زیرعنوان",
        image: "/media/safe-slide.jpg",
        alt_text: "اسلاید امن",
        href: null,
        is_active: true,
        order: 0,
      },
      {
        id: 94,
        title: "اسلاید ناامن",
        subtitle: "زیرعنوان",
        image: "//evil.example/slide.jpg",
        alt_text: "اسلاید ناامن",
        href: null,
        is_active: true,
        order: 1,
      },
    ]);

    render(<HomeSliderSection />);
    await waitFor(() => expect(document.querySelector('img[src="/media/safe-slide.jpg"]')).toBeInTheDocument());

    expect(document.querySelectorAll('img[src="//evil.example/slide.jpg"]')).toHaveLength(0);
  });

  it("drops an unsafe site-settings hero_image fallback instead of rendering it", async () => {
    settingsMock.mockResolvedValue({ school_name: "بعثت", hero_image: "//evil.example/hero.jpg" });
    slidesMock.mockResolvedValue([]);

    render(<HomeSliderSection />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(document.querySelectorAll('img[src="//evil.example/hero.jpg"]')).toHaveLength(0);
  });
});
