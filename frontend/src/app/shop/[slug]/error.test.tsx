import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
  usePathname: () => "/shop/qa-product",
}));

import ShopProductError from "@/app/shop/[slug]/error";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// REL-FE-BACKEND-TIMEOUT-001-R4: reset() alone re-renders this boundary's
// children but does not reliably re-invoke the Server Component
// (loadProduct() in page.tsx) that threw -- a live probe found clicking
// "تلاش دوباره" emitted no RSC/document request at all. The retry handler
// must call router.refresh() (which does force a fresh server request) in
// addition to reset().
describe("ShopProductError retry", () => {
  it("calls both router.refresh() and reset() when the retry button is clicked", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc" });

    render(<ShopProductError error={error} reset={reset} />);
    screen.getByRole("button", { name: "تلاش دوباره" }).click();

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // REL-FE-BACKEND-TIMEOUT-RETRY-DOUBLE-REFRESH-001: two same-turn clicks
  // on the real button fired two redundant RSC refreshes. `retryingRef`
  // blocks a second click that lands before the first attempt settles.
  it("ignores a second same-turn click while the first retry is still pending", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc" });

    render(<ShopProductError error={error} reset={reset} />);
    const button = screen.getByRole("button", { name: "تلاش دوباره" });

    // Both clicks land in the same synchronous stack frame, with no
    // render between them -- this is exactly why the guard is a ref
    // (written immediately, before either click handler returns) rather
    // than the `isRetrying` state alone (which wouldn't reflect the first
    // click until React actually re-renders).
    button.click();
    button.click();

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("allows a later deliberate retry after the first attempt has settled", async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc" });

    render(<ShopProductError error={error} reset={reset} />);
    const button = screen.getByRole("button", { name: "تلاش دوباره" });

    // The transition has no real async work in this test (router.refresh
    // and reset are both plain mocks), so it settles within a task -- an
    // act()-wrapped macrotask flush lets both the transition itself and
    // the effect that releases retryingRef run to completion.
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    button.click();

    expect(refreshMock).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(2);
  });
});
