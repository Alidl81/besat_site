import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { newsMock, achievementsMock, galleryMock, unitsMock, departmentsMock, tourScenesMock } = vi.hoisted(() => ({
  newsMock: vi.fn(),
  achievementsMock: vi.fn(),
  galleryMock: vi.fn(),
  unitsMock: vi.fn(),
  departmentsMock: vi.fn(),
  tourScenesMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicNews: newsMock,
  getPublicAchievements: achievementsMock,
  getPublicGallery: galleryMock,
  getPublicUnits: unitsMock,
  getPublicDepartments: departmentsMock,
}));
vi.mock("@/services/virtual-tour-service", () => ({
  getPublicTourDoorScenes: tourScenesMock,
}));
vi.mock("@/components/virtual-tour/panorama-viewer", () => ({
  PanoramaViewer: () => <div data-testid="panorama-viewer" />,
}));
vi.mock("@/components/shared/besat-logo", () => ({
  BesatLogoMark: () => <span data-testid="besat-logo" />,
}));

// Keep this probe focused on the public image sinks rather than the selector's
// animation or the modal focus lifecycle. The real CircularExplorer remains
// mounted; only its presentational children are reduced to deterministic tabs.
vi.mock("@/components/circular/circular-selector", () => ({
  CircularSelector: () => <div data-testid="circular-selector" />,
}));
vi.mock("@/components/circular/scoped-tabs", () => ({
  ScopedTabs: ({ tabs, onChange, children }: {
    tabs: Array<{ key: string; label: string }>;
    onChange: (key: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <div role="tablist">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" onClick={() => onChange(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  ),
}));
vi.mock("@/hooks/use-focus-trap", () => ({
  useFocusTrap: () => undefined,
}));

const unsafeNews = {
  id: 1,
  title: "خبر با تصویر کنترل‌نشده",
  slug: "unsafe-news",
  summary: "خلاصه",
  cover_image: "//evil.example/news.jpg",
  published_at: "2026-08-30T00:00:00Z",
  category: null,
};

const unsafeAchievement = {
  id: 2,
  title: "افتخار با تصویر کنترل‌نشده",
  description: "شرح",
  image: "//evil.example/achievement.jpg",
  achieved_at: "2026-08-30T00:00:00Z",
};

const unsafeGallery = {
  id: 3,
  title: "گالری با تصویر کنترل‌نشده",
  image: "//evil.example/gallery.jpg",
  alt_text: "تصویر",
};

const unsafeUnit = {
  id: 4,
  title: "واحد با تصویر کنترل‌نشده",
  slug: "unsafe-unit",
  description: "شرح",
  cover_image: "//evil.example/unit.jpg",
};

const unsafeProduct = {
  id: 5,
  product_type: "physical",
  title: "محصول با تصویر کنترل‌نشده",
  slug: "unsafe-product",
  short_description: null,
  featured_image: "//evil.example/product.jpg",
  category: null,
  tags: [],
  price_amount: 100000,
  sale_price_amount: null,
  price_display: null,
  sale_price_display: null,
  is_on_sale: false,
  is_featured: false,
  is_important: false,
  status: "published",
  is_published: true,
  physical_detail: {
    availability: "in_stock",
    weight_grams: null,
    requires_shipping: false,
    max_purchase_quantity: null,
  },
  course_detail: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  newsMock.mockResolvedValue({ results: [unsafeNews] });
  achievementsMock.mockResolvedValue({ results: [unsafeAchievement] });
  galleryMock.mockResolvedValue({ results: [unsafeGallery] });
  unitsMock.mockResolvedValue([unsafeUnit]);
  departmentsMock.mockResolvedValue([]);
  tourScenesMock.mockResolvedValue([]);
});

afterEach(() => cleanup());

// SEC-FE-PUBLIC-MEDIA-SINK-001 + SEC-FE-SHOP-PUBLIC-MEDIA-SINK-001: these
// public surfaces copied a free-text CMS media URL directly into an <img
// src>, so a protocol-relative "//evil.example/..." URL was left unchanged
// and the browser resolved it off-origin. Every sink below now runs the
// value through the shared safePublicMediaUrl() (already used by sibling
// public surfaces such as about-content.tsx/achievements-list.tsx), which
// rejects anything that isn't a same-origin relative path or an absolute
// http(s) URL.
describe("public CMS media URL safety", () => {
  it("does not render an unsanitized protocol-relative News cover URL in HomeNewsSection", async () => {
    const { HomeNewsSection } = await import("@/components/home/home-news-section");
    render(<HomeNewsSection />);

    await waitFor(() => expect(screen.getByText(unsafeNews.title)).toBeInTheDocument());
    expect(document.querySelector(`img[src="${unsafeNews.cover_image}"]`)).toBeNull();
    expect(screen.queryByRole("img", { name: unsafeNews.title })).not.toBeInTheDocument();
  });

  it("does not render unsanitized protocol-relative News, Achievement, or Gallery URLs in CircularExplorer", async () => {
    const { CircularExplorer } = await import("@/components/circular/circular-explorer");
    render(
      <CircularExplorer
        items={[{ id: "unit-1", title: "واحد آزمون", slug: "unit-1" }]}
        descriptions={{ "unit-1": "توضیح" }}
        variant="unit"
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "اخبار" }));
    await waitFor(() => expect(screen.getByText(unsafeNews.title)).toBeInTheDocument());
    expect(document.querySelector(`img[src="${unsafeNews.cover_image}"]`)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "افتخارات" }));
    await waitFor(() => expect(screen.getByText(unsafeAchievement.title)).toBeInTheDocument());
    expect(document.querySelector(`img[src="${unsafeAchievement.image}"]`)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "گالری" }));
    await waitFor(() => expect(screen.getByText(unsafeGallery.title)).toBeInTheDocument());
    expect(document.querySelector(`img[src="${unsafeGallery.image}"]`)).toBeNull();
  });

  it("does not render an unsanitized protocol-relative unit cover in VirtualTourLobby", async () => {
    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    fireEvent.click(await screen.findByRole("button", { name: /واحدهای آموزشی/ }));
    await waitFor(() => {
      expect(document.querySelector('img[src="//evil.example/unit.jpg"]')).toBeNull();
    });
  });

  it("does not render an unsanitized protocol-relative product image in ProductCard", async () => {
    const { ProductCard } = await import("@/components/shop/product-card");
    render(<ProductCard product={unsafeProduct as never} />);

    expect(document.querySelector('img[src="//evil.example/product.jpg"]')).toBeNull();
  });

  it("does not render an unsanitized protocol-relative cover in HomeUnitsCarousel", async () => {
    const { HomeUnitsCarousel } = await import("@/components/home/home-units-carousel");
    render(<HomeUnitsCarousel units={[unsafeUnit as never]} />);

    expect(document.querySelector('img[src="//evil.example/unit.jpg"]')).toBeNull();
  });
});
