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

// FE-HOME-SLIDE-HREF-001: a CMS slide's href (backend/apps/home/models.py's
// own field: "can be an internal path like /about or a full link") was
// mapped into slide state but never actually read anywhere except the
// auto-generated news-slide branch -- so any admin-configured slide
// destination was silently ineffective, and the safety question ("what if
// an admin pastes javascript:...") never even arose because the value was
// never used as a real href to begin with.
describe("HomeSliderSection CMS href boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    slidesMock.mockResolvedValue([
      {
        id: 9,
        title: "اسلاید مدیریت‌شده",
        subtitle: "زیرعنوان",
        image: "/media/slide.jpg",
        alt_text: "اسلاید",
        href: "javascript:alert(1)",
        is_active: true,
        order: 0,
      },
    ]);
    settingsMock.mockResolvedValue({ school_name: "بعثت", hero_image: null });
    newsMock.mockResolvedValue({ results: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not turn an untrusted CMS href into an executable/unsafe link", async () => {
    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    const links = screen.queryAllByRole("link");
    const slideLink = links.find((link) => link.textContent?.includes("پیش‌ثبت‌نام") || link.getAttribute("href")?.includes("javascript:"));

    expect(slideLink?.getAttribute("href")).not.toBe("javascript:alert(1)");
  });

  it("uses the configured CMS slide destination with a neutral action label", async () => {
    slidesMock.mockResolvedValueOnce([
      {
        id: 10,
        title: "پیوند اسلاید",
        subtitle: "زیرعنوان",
        image: "/media/slide.jpg",
        alt_text: "اسلاید",
        href: "/about?from=home-slide",
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "مشاهده بیشتر" })).toHaveAttribute(
      "href",
      "/about?from=home-slide",
    );
  });

  it("uses a genuine external http(s) CMS slide destination too", async () => {
    slidesMock.mockResolvedValueOnce([
      {
        id: 11,
        title: "پیوند خارجی",
        subtitle: "زیرعنوان",
        image: "/media/slide.jpg",
        alt_text: "اسلاید",
        href: "https://partner.example/program",
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "مشاهده بیشتر" })).toHaveAttribute(
      "href",
      "https://partner.example/program",
    );
    expect(screen.getByRole("link", { name: "مشاهده بیشتر" })).toHaveAttribute("target", "_blank");
  });

  it("renders no primary CTA for a protocol-relative bypass href", async () => {
    slidesMock.mockResolvedValueOnce([
      {
        id: 12,
        title: "پیوند نامعتبر",
        subtitle: "زیرعنوان",
        image: "/media/slide.jpg",
        alt_text: "اسلاید",
        href: "//evil.example/phish",
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "مطالعه کامل خبر" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "مشاهده بیشتر" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /پیش‌ثبت‌نام/ })).not.toBeInTheDocument();
  });

  it("uses the news route and news label for a featured news slide", async () => {
    newsMock.mockResolvedValueOnce({
      results: [
        {
          id: 17,
          slug: "spring-news",
          title: "خبر بهاری",
          summary: "خلاصه خبر",
          cover_image: "/media/news.jpg",
          image: null,
        },
      ],
    });

    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "مطالعه کامل خبر" })).toHaveAttribute(
      "href",
      "/news/spring-news",
    );
  });

  it("labels a unit slide as a unit destination", async () => {
    slidesMock.mockResolvedValueOnce([
      {
        id: 13,
        title: "واحد دخترانه",
        subtitle: "معرفی واحد",
        image: "/media/slide.jpg",
        alt_text: "اسلاید",
        href: "/units/girls-one",
        is_active: true,
        order: 0,
      },
    ]);

    render(<HomeSliderSection />);

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "مشاهده واحد" })).toHaveAttribute(
      "href",
      "/units?unit=girls-one",
    );
  });
});
