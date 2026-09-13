import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicNews: vi.fn().mockResolvedValue({
    results: [{
      id: "news-1",
      slug: "news-1",
      title: "خبر آزمون",
      summary: "خلاصه خبر",
      cover_image: null,
      published_at: null,
      category: null,
    }],
  }),
  getPublicAchievements: vi.fn().mockResolvedValue({
    results: [{
      id: "achievement-1",
      title: "افتخار آزمون",
      description: "شرح افتخار",
      image: null,
      achieved_at: null,
    }],
  }),
  getPublicGallery: vi.fn().mockResolvedValue({
    results: [{
      id: "gallery-1",
      title: "تصویر آزمون",
      image: "/media/test.jpg",
      alt_text: "تصویر آزمون",
    }],
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  document.body.style.overflow = "";
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.resetModules();
});

async function renderExplorer() {
  const { CircularExplorer } = await import("@/components/circular/circular-explorer");
  render(
    <CircularExplorer
      items={[{ id: "unit-1", title: "واحد آزمون", slug: "unit-1" }]}
      descriptions={{ "unit-1": "توضیح" }}
      variant="unit"
    />,
  );
  await act(async () => {
    vi.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

describe("CircularExplorer URL state", () => {
  it("restores the selected unit and tab, then writes compact deep links", async () => {
    window.history.replaceState({}, "", "/units?unit=unit-2&tab=news");
    const { CircularExplorer } = await import("@/components/circular/circular-explorer");
    render(
      <CircularExplorer
        items={[
          { id: "unit-1", title: "واحد اول", slug: "unit-1" },
          { id: "unit-2", title: "واحد دوم", slug: "unit-2" },
        ]}
        descriptions={{ "unit-1": "یک", "unit-2": "دو" }}
        variant="unit"
        initialSlug="unit-2"
        initialTab="news"
      />,
    );
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(screen.getByRole("tab", { name: /اخبار/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /گالری/ }));
    expect(window.location.pathname).toBe("/units");
    expect(window.location.search).toBe("?unit=unit-2&tab=gallery");

    fireEvent.click(screen.getByRole("button", { name: "واحد اول" }));
    expect(window.location.search).toBe("?unit=unit-1&tab=gallery");
  });

  it("falls back to the first public item for an invalid slug", async () => {
    const { CircularExplorer } = await import("@/components/circular/circular-explorer");
    render(
      <CircularExplorer
        items={[{ id: "unit-1", title: "واحد اول", slug: "unit-1" }]}
        descriptions={{ "unit-1": "یک" }}
        variant="unit"
        initialSlug="missing-unit"
      />,
    );
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });
    expect(screen.getAllByText("واحد اول").length).toBeGreaterThan(0);
  });
});

async function flushTabContent() {
  await act(async () => {
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

// FE-CIRCULAR-MODAL-A11Y-001: none of these three overlays had dialog
// semantics, a focus trap, an Escape path, or opener-focus restoration --
// they were plain <div>s. This is CircularExplorer's first permanent test
// file (it previously had none at all).
describe("CircularExplorer modal accessibility", () => {
  it("gives the news detail overlay dialog semantics, initial focus, and Escape-to-close with opener restoration", async () => {
    await renderExplorer();
    fireEvent.click(screen.getByRole("tab", { name: "اخباراخبار" }));
    await flushTabContent();
    const opener = screen.getByRole("button", { name: /مشاهده کامل/ });
    // jsdom's fireEvent.click, unlike a real browser click, doesn't move
    // focus to the clicked element on its own -- focus it explicitly so
    // useFocusTrap's opener-focus capture has something real to restore.
    opener.focus();
    fireEvent.click(opener);

    const overlay = document.querySelector(".besat-modal-overlay");
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("aria-modal", "true");
    expect(overlay).toHaveAttribute("aria-labelledby", "circular-news-modal-title");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "بستن" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".besat-modal-overlay")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("gives the achievement detail overlay dialog semantics and a named close button", async () => {
    await renderExplorer();
    fireEvent.click(screen.getByRole("tab", { name: "افتخاراتافتخارات" }));
    await flushTabContent();
    fireEvent.click(screen.getByRole("button", { name: /مشاهده کامل/ }));

    const overlay = document.querySelector(".besat-modal-overlay");
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "بستن" })).toBeInTheDocument();
  });

  it("gives the gallery lightbox dialog semantics and a named close button instead of an unlabeled glyph", async () => {
    await renderExplorer();
    fireEvent.click(screen.getByRole("tab", { name: "گالریگالری" }));
    await flushTabContent();
    fireEvent.click(screen.getByRole("button", { name: /تصویر آزمون/ }));

    const overlay = document.querySelector(".besat-modal-overlay");
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("aria-modal", "true");
    const closeButton = screen.getByRole("button", { name: "بستن" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".besat-modal-overlay")).not.toBeInTheDocument();
  });
});
