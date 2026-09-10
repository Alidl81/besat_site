import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let currentQuery = "";
const { replaceMock, shopProductsMock, shopCategoriesMock, newsMock, newsCategoriesMock, newsUnitsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  shopProductsMock: vi.fn(async () => ({ count: 0, results: [], next: null, previous: null })),
  shopCategoriesMock: vi.fn(async () => []),
  newsMock: vi.fn(async () => ({ count: 0, results: [], next: null, previous: null })),
  newsCategoriesMock: vi.fn(async () => []),
  newsUnitsMock: vi.fn(async () => []),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => "/shop",
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

vi.mock("@/services/shop-service", () => ({
  getShopProducts: shopProductsMock,
  getShopCategories: shopCategoriesMock,
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicNews: newsMock,
  getPublicNewsCategories: newsCategoriesMock,
  getPublicUnits: newsUnitsMock,
}));

vi.mock("@gsap/react", () => ({
  useGSAP: () => undefined,
}));
vi.mock("gsap", () => ({ gsap: { set: vi.fn(), to: vi.fn() } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { batch: vi.fn(() => []) } }));

import { ShopExplorer } from "@/components/shop/shop-explorer";
import { NewsHub } from "@/components/news/news-hub";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  currentQuery = "";
  shopProductsMock.mockResolvedValue({ count: 0, results: [], next: null, previous: null });
  shopCategoriesMock.mockResolvedValue([]);
  newsMock.mockResolvedValue({ count: 0, results: [], next: null, previous: null });
  newsCategoriesMock.mockResolvedValue([]);
  newsUnitsMock.mockResolvedValue([]);
});

// FE-CATALOG-FILTER-URL-REHYDRATION-001: both ShopExplorer and NewsHub used
// to seed their filter/page state from useSearchParams() via a
// useMemo(..., []) that only ever ran once, at mount. Next re-renders the
// same component instance in place (not a fresh mount) when the route's
// search params change without the component itself causing it -- browser
// back/forward, or a link elsewhere in the app pointing at this route with
// different query params -- and neither component reacted to that at all,
// silently continuing to serve whatever filters/page it had mounted with.
// Both now also rehydrate filters/page from a dedicated effect keyed on the
// search params' own string form, which fires on every such change.
describe("catalog filter state follows Next search-param rerenders", () => {
  it("reloads ShopExplorer from a changed query string instead of retaining the first mount", async () => {
    vi.useFakeTimers();
    currentQuery = "q=old";
    const view = render(<ShopExplorer />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });
    expect(shopProductsMock).toHaveBeenCalledWith(expect.objectContaining({ search: "old", type: undefined }), expect.anything());
    shopProductsMock.mockClear();

    currentQuery = "q=new&type=physical";
    view.rerender(<ShopExplorer />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(shopProductsMock).toHaveBeenCalledWith(expect.objectContaining({ search: "new", type: "physical" }), expect.anything());
  });

  it("reloads NewsHub from a changed query string instead of retaining the first mount", async () => {
    vi.useFakeTimers();
    currentQuery = "search=old";
    const view = render(<NewsHub />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });
    expect(newsMock).toHaveBeenCalledWith(expect.objectContaining({ search: "old", unit_id: undefined }), expect.anything());
    newsMock.mockClear();

    currentQuery = "search=new&unit=7";
    view.rerender(<NewsHub />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(newsMock).toHaveBeenCalledWith(expect.objectContaining({ search: "new", unit_id: "7" }), expect.anything());
  });

  // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001: the rehydration fix above
  // originally updated `filters` (search/type/category/page) immediately
  // but left the debounced-search value to catch up 400ms/350ms later via
  // its own separate effect -- an external URL change updating both the
  // search term and a non-debounced filter (type, unit, page) landed in
  // two separate commits: one with the non-debounced filter already
  // updated but the debounced search still stale (an immediate fetch with
  // a mixed old-search/new-filter tuple), then a second, correct fetch
  // once the debounce caught up. Both components now update the debounced
  // search value in the exact same batched effect call as the rest of the
  // rehydrated filters, landing in a single commit with a single fetch.
  it("does not fetch a mixed old/new ShopExplorer query during external navigation", async () => {
    vi.useFakeTimers();
    currentQuery = "q=old&page=3";
    const view = render(<ShopExplorer />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });
    shopProductsMock.mockClear();

    currentQuery = "q=new&type=physical&page=2";
    view.rerender(<ShopExplorer />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(shopProductsMock).toHaveBeenCalledTimes(1);
    expect(shopProductsMock).toHaveBeenCalledWith(expect.objectContaining({
      search: "new",
      type: "physical",
      page: 2,
    }), expect.anything());
  });

  it("does not fetch a mixed old/new NewsHub query during external navigation", async () => {
    vi.useFakeTimers();
    currentQuery = "search=old&unit=6&page=3";
    const view = render(<NewsHub />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });
    newsMock.mockClear();

    currentQuery = "search=new&page=1";
    view.rerender(<NewsHub />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(newsMock).toHaveBeenCalledTimes(1);
    expect(newsMock).toHaveBeenCalledWith(expect.objectContaining({
      search: "new",
      unit_id: undefined,
      page: 1,
    }), expect.anything());
  });
});
