import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { newsMock, newsCategoriesMock, newsUnitsMock } = vi.hoisted(() => ({
  newsMock: vi.fn(async (...args: [unknown?, AbortSignal?]) => {
    void args;
    return { count: 0, results: [], next: null, previous: null };
  }),
  newsCategoriesMock: vi.fn(async () => [{ slug: "achievement", title: "افتخارات" }]),
  newsUnitsMock: vi.fn(async () => [{ id: 1, title: "واحد یک" }]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/news",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicNews: newsMock,
  getPublicNewsCategories: newsCategoriesMock,
  getPublicUnits: newsUnitsMock,
}));

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({ gsap: { set: vi.fn(), to: vi.fn() } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { batch: vi.fn(() => []) } }));

import { NewsHub } from "@/components/news/news-hub";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/news");
});

async function flush() {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

function lastQuery() {
  return newsMock.mock.calls[newsMock.mock.calls.length - 1]?.[0] as { search?: string } | undefined;
}

// FE-NEWS-FILTER-CLEAR-MIXED-001: clicking "حذف فیلترها" while a category/unit
// AND a search term were all active used to only call
// setFilters(initialFilters) -- filters.search reset immediately, but the
// fetch effect actually queries with the separate `debouncedSearch` state,
// which the debounce effect only catches up 350ms later. Resetting
// categorySlug/unitId (direct fetch-effect dependencies) fired the fetch
// effect immediately, using the still-stale debouncedSearch -- producing a
// wrong empty-result fetch and writing the stale search term back into the
// URL via syncUrl(). clearFilters() now resets debouncedSearch in the same
// commit as filters, so the very next fetch already has no search term.
describe("NewsHub clear-filters with a mixed category+unit+search state", () => {
  it("does not re-apply the stale search term on the fetch immediately triggered by clearing category/unit", async () => {
    vi.useFakeTimers();
    render(<NewsHub />);
    await flush();
    expect(screen.getByText("افتخارات")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("دسته‌بندی"), { target: { value: "achievement" } });
    });
    await flush();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("واحد آموزشی"), { target: { value: "1" } });
    });
    await flush();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("مثلاً: جشنواره، مسابقه، اردو"), {
        target: { value: "بدون-نتیجه" },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(lastQuery()?.search).toBe("بدون-نتیجه");

    const callsBeforeClear = newsMock.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "حذف فیلترها" })[0]);
    });
    await flush();

    expect(newsMock.mock.calls.length).toBeGreaterThan(callsBeforeClear);
    const immediateCallAfterClear = newsMock.mock.calls[callsBeforeClear][0] as { search?: string };
    expect(immediateCallAfterClear.search).toBeUndefined();

    // No further debounce settlement should reintroduce the cleared term,
    // and the URL syncUrl() writes must not carry it either.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(lastQuery()?.search).toBeUndefined();
    expect(window.location.search).toBe("");
    expect(screen.getByPlaceholderText("مثلاً: جشنواره، مسابقه، اردو")).toHaveValue("");
  });
});
