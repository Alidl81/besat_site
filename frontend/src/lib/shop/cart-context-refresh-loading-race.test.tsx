import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart } = vi.hoisted(() => ({ getCart: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/shop" }));
vi.mock("@/services/shop-service", () => ({
  getCart,
  addCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function emptyCart() {
  return {
    id: 1,
    items: [],
    item_count: 0,
    subtotal_amount: 0,
    subtotal_display: "۰ تومان",
    requires_shipping: false,
    has_blocking_issue: false,
  };
}

type CartResult = {
  data: ReturnType<typeof emptyCart>;
  guestToken: string | null;
  clearGuestToken: boolean;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-REFRESH-LOADING-RACE-001: refresh()'s finally/catch
// used to unconditionally clear `loading`/apply `error`, so whichever of
// two overlapping refresh() calls settled *first* -- regardless of which
// was issued more recently -- could flip loading back to idle, or surface
// a stale failure, while a still-pending, more-recently-issued refresh's
// authoritative result hadn't arrived yet. latestRefreshCallSeqRef (the seq
// of the most recently *issued* refresh call) now gates both: only the
// call that is still the newest one issued when it settles is allowed to
// touch loading/error.
describe("ShopCartProvider refresh loading state", () => {
  it("keeps loading true until the newest overlapping refresh settles", async () => {
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    const initial: CartResult = { data: emptyCart(), guestToken: null, clearGuestToken: false };
    getCart
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { loading, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void refresh()}>بازخوانی</button>
          <output data-testid="loading">{loading ? "loading" : "idle"}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("idle"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      await Promise.resolve();
    });
    expect(getCart).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");

    await act(async () => {
      older.resolve({ data: emptyCart(), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("loading");

    await act(async () => {
      newer.resolve({ data: emptyCart(), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("idle");
  });

  it("does not surface an older refresh error while the newest request is pending", async () => {
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    const initial: CartResult = { data: emptyCart(), guestToken: null, clearGuestToken: false };
    getCart
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { loading, error, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void refresh()}>بازخوانی</button>
          <output data-testid="loading">{loading ? "loading" : "idle"}</output>
          <output data-testid="error">{error ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("idle"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      await Promise.resolve();
    });

    await act(async () => {
      older.reject(new Error("stale refresh failure"));
      await Promise.resolve();
    });

    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");

    await act(async () => {
      newer.resolve({ data: emptyCart(), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("idle");
  });
});
