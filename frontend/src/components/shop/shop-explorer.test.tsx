import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => "/shop",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/services/shop-service", () => ({
  getShopProducts: vi.fn(async () => ({ count: 0, results: [], next: null, previous: null })),
  getShopCategories: vi.fn(async () => []),
}));

import { getShopProducts } from "@/services/shop-service";
import { ShopExplorer } from "@/components/shop/shop-explorer";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ShopExplorer search", () => {
  it("applies a typed search term to both the fetch and the URL after the debounce window", async () => {
    vi.useFakeTimers();
    render(<ShopExplorer />);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    (getShopProducts as ReturnType<typeof vi.fn>).mockClear();
    replaceMock.mockClear();

    const input = screen.getByPlaceholderText("عنوان کتاب یا دوره…");
    fireEvent.change(input, { target: { value: "گزینه‌ها" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getShopProducts).toHaveBeenCalledWith(expect.objectContaining({ search: "گزینه‌ها" }), expect.anything());
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining("q="), expect.anything());
  });

  it("does not fire a duplicate request per keystroke -- only once after the last change", async () => {
    vi.useFakeTimers();
    render(<ShopExplorer />);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    (getShopProducts as ReturnType<typeof vi.fn>).mockClear();

    const input = screen.getByPlaceholderText("عنوان کتاب یا دوره…");
    fireEvent.change(input, { target: { value: "گ" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "گز" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "گزی" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Not just "the final term was requested once" -- exactly one request
    // total for the whole rapid-typing burst. This is what actually
    // regressed once already (FE-SHOP-FILTER-003): an earlier version of
    // this fix fired one extra, unfiltered request per intermediate
    // keystroke in addition to the correct final one, which a weaker
    // assertion here (only checking the final value's call count) missed
    // entirely.
    expect(getShopProducts).toHaveBeenCalledTimes(1);
    expect(getShopProducts).toHaveBeenCalledWith(expect.objectContaining({ search: "گزی" }), expect.anything());
  });
});
