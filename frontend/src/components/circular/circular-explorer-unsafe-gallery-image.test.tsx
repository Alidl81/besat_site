import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const galleryMock = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicNews: vi.fn(),
  getPublicAchievements: vi.fn(),
  getPublicGallery: galleryMock,
}));

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

const unsafeGallery = {
  id: 3,
  title: "تصویر نامعتبر",
  slug: "unsafe-gallery",
  summary: null,
  image: "//evil.example/gallery.jpg",
  album: null,
  alt_text: "تصویر نامعتبر",
  caption: null,
  event_date: null,
  published_at: "2026-08-30T00:00:00Z",
  scope: "unit",
  unit_id: 1,
  unit: null,
  status: "published",
  is_published: true,
  is_featured: false,
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  vi.clearAllMocks();
});

// FE-CIRCULAR-GALLERY-UNSAFE-IMAGE-LOCK-001: GalleryTab's lightbox is
// purely an image viewer -- its dialog JSX only renders when the
// sanitized `lightboxImage` (safePublicMediaUrl(lightbox?.image)) is
// non-null, since there's nothing else to show without a valid image. But
// the focus trap that owns the body-scroll lock was activated off the
// raw, unsanitized `lightbox?.image` string instead -- truthy even for a
// rejected URL (e.g. a protocol-relative "//evil.example/..."), so
// selecting an item with an unsafe image engaged the scroll lock/focus
// trap for a dialog that was never actually shown, leaving the page
// permanently locked with no visible way to escape it. Fixed by computing
// `lightboxImage` before the focus-trap call and using it (not the raw
// value) as the trap's activation condition, matching the same condition
// the dialog's own render already uses.
describe("CircularExplorer unsafe gallery selection", () => {
  it("does not lock the document when a selected gallery image is rejected", async () => {
    galleryMock.mockResolvedValue({ results: [unsafeGallery] });
    const { CircularExplorer } = await import("@/components/circular/circular-explorer");

    render(
      <CircularExplorer
        items={[{ id: "unit-1", title: "واحد آزمون", slug: "unit-1" }]}
        descriptions={{ "unit-1": "توضیح" }}
        variant="unit"
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "گالری" }));
    const item = await screen.findByRole("button", { name: /تصویر نامعتبر/ });
    fireEvent.click(item);

    await waitFor(() => expect(document.body.style.overflow).toBe(""));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
