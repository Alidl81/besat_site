/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- this test intentionally supplies an unsafe image URL to the renderer stub. */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("@/lib/motion/gsap-scroll-trigger", () => ({
  ensureScrollTriggerRegistered: () => undefined,
  prefersReducedMotion: () => true,
}));
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const getPublicGallery = vi.fn(async () => ({
  results: [
    {
      id: 901,
      title: "رکورد تصویر نامعتبر",
      image: "//evil.example/gallery.jpg",
      alt_text: "",
      caption: null,
      summary: null,
      album: null,
      event_date: null,
      is_featured: false,
      unit: null,
    },
  ],
  count: 1,
  next: null,
  previous: null,
}));
const getPublicUnits = vi.fn(async () => []);
vi.mock("@/services/public-content-service", () => ({
  getPublicGallery,
  getPublicUnits,
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  document.body.style.overflow = "";
});

// FE-GALLERY-UNSAFE-IMAGE-BLANK-LIGHTBOX-001: GalleryCard stays clickable
// for an item whose image safePublicMediaUrl() rejects (it shows a
// placeholder icon instead of the <Image>, but the onClick still opens
// the lightbox), and gallery-explorer.tsx's lightboxItems coerces such an
// item's src to "" rather than excluding it (removing it would disturb
// index correspondence with the rest of the list). GalleryLightbox now
// treats an item with no valid src the same as no item at all -- see
// gallery-lightbox.test.tsx for the focused unit-level coverage of that
// fix; this test exercises the full click-to-open path end to end.
describe("GalleryExplorer unsafe-image lifecycle", () => {
  it("does not open a blank lightbox for a rejected media URL", async () => {
    const { GalleryExplorer } = await import("@/components/gallery/gallery-explorer");
    render(<GalleryExplorer />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    const cardTitle = screen.getByRole("heading", { name: "رکورد تصویر نامعتبر" });
    fireEvent.click(cardTitle.closest("button")!);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector('img[src=""]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
