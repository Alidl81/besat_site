import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const currentQuery = "";
const { replaceMock, shopProductsMock, shopCategoriesMock, newsMock, newsCategoriesMock, newsUnitsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  shopProductsMock: vi.fn(async (...args: [unknown?, AbortSignal?]) => { void args; return { count: 0, results: [], next: null, previous: null }; }),
  shopCategoriesMock: vi.fn(async () => []),
  newsMock: vi.fn(async (...args: [unknown?, AbortSignal?]) => { void args; return { count: 0, results: [], next: null, previous: null }; }),
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

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({ gsap: { set: vi.fn(), to: vi.fn() } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { batch: vi.fn(() => []) } }));

import { ShopExplorer } from "@/components/shop/shop-explorer";
import { NewsHub } from "@/components/news/news-hub";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// FE-CATALOG-FILTER-URL-MIXED-REQUEST-001 (residual): PARTIAL_VERIFIED
// noted that "active" flags only ever suppressed a superseded request's
// *result* once it landed -- the request itself still reached the
// transport and ran to completion, wasting bandwidth/backend load on a
// response nobody would use. getShopProducts()/getPublicNews() now accept
// an optional AbortSignal, and both components create a fresh
// AbortController per fetch-effect invocation, passing its signal through
// and aborting it in the effect's cleanup. Codex's own rapid-transition
// probe mocks getShopProducts/getPublicNews directly, so it cannot observe
// this -- a mocked service function resolves regardless of whether its
// signal was ever aborted. These tests instead capture the actual signal
// passed to each call and assert the earlier one is aborted once a later
// fetch-effect run supersedes it, verifying the cancellation wiring
// directly (mirroring cart-transport.test.ts's "honors an explicit
// caller-provided signal" pattern).
describe("catalog fetch effects cancel a superseded request's transport", () => {
  it("aborts ShopExplorer's previous request signal once a debounced search change supersedes it", async () => {
    vi.useFakeTimers();
    const capturedSignals: (AbortSignal | undefined)[] = [];
    shopProductsMock.mockImplementation(async (_query: unknown, signal?: AbortSignal) => {
      capturedSignals.push(signal);
      return { count: 0, results: [], next: null, previous: null };
    });

    render(<ShopExplorer />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(capturedSignals).toHaveLength(1);
    const firstSignal = capturedSignals[0];
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(false);

    const input = screen.getByPlaceholderText("عنوان کتاب یا دوره…");
    fireEvent.change(input, { target: { value: "کتاب" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(capturedSignals.length).toBeGreaterThan(1);
    expect(firstSignal?.aborted).toBe(true);
  });

  it("aborts NewsHub's previous request signal once a debounced search change supersedes it", async () => {
    vi.useFakeTimers();
    const capturedSignals: (AbortSignal | undefined)[] = [];
    newsMock.mockImplementation(async (_query: unknown, signal?: AbortSignal) => {
      capturedSignals.push(signal);
      return { count: 0, results: [], next: null, previous: null };
    });

    render(<NewsHub />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(capturedSignals).toHaveLength(1);
    const firstSignal = capturedSignals[0];
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(false);

    const input = screen.getByPlaceholderText("مثلاً: جشنواره، مسابقه، اردو");
    fireEvent.change(input, { target: { value: "جشنواره" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(capturedSignals.length).toBeGreaterThan(1);
    expect(firstSignal?.aborted).toBe(true);
  });
});
