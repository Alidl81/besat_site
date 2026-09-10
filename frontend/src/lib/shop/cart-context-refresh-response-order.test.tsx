import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, updateCartItem } = vi.hoisted(() => ({
  getCart: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/shop" }));
vi.mock("@/services/shop-service", () => ({
  getCart,
  updateCartItem,
  addCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function cartWithQuantity(quantity: number) {
  const item = {
    id: 41,
    product: {
      id: 41,
      title: "کتاب اول",
      slug: "book-41",
      product_type: "physical" as const,
      featured_image: null,
    },
    variant: null,
    variant_title: null,
    quantity,
    unit_price_amount: 1000,
    unit_price_display: "۱٬۰۰۰ تومان",
    line_total_amount: quantity * 1000,
    line_total_display: `${quantity * 1000}`,
    issue: null,
  };
  return {
    id: 1,
    items: [item],
    item_count: quantity,
    subtotal_amount: quantity * 1000,
    subtotal_display: "",
    requires_shipping: true,
    has_blocking_issue: false,
  };
}

type CartResult = {
  data: ReturnType<typeof cartWithQuantity>;
  guestToken: string | null;
  clearGuestToken: boolean;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-REFRESH-RESPONSE-ORDER-001: two overlapping
// refresh() calls are both plain full-cart GETs of the same resource --
// unlike a refresh racing a targeted mutation (which needed a call-time
// exclusion set, not a plain "later wins" rule, since the mutation's
// response is authoritative for its own item regardless of issue order),
// two GETs have no such asymmetry. refresh() now stamps a seq (from the
// same monotonic counter used by updateItem/removeItem) and only applies
// a response if it's not older than the last-applied refresh.
describe("ShopCartProvider refresh response ordering", () => {
  it("does not let an older concurrent refresh overwrite the newer snapshot", async () => {
    const initial = cartWithQuantity(1);
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    getCart
      .mockResolvedValueOnce({ data: initial, guestToken: null, clearGuestToken: false })
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void refresh()}>بازخوانی</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      await Promise.resolve();
    });
    expect(getCart).toHaveBeenCalledTimes(3);

    await act(async () => {
      newer.resolve({ data: cartWithQuantity(3), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");

    await act(async () => {
      older.resolve({ data: cartWithQuantity(2), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    // Both responses are valid snapshots; the one issued later must remain
    // authoritative when the earlier request settles last.
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");
  });
});

// Broader regression matrix (adjacent Codex coverage): three overlapping
// same-item mutations (one rejected), a stale refresh captured while the
// newest mutation is still pending, and a later independent refresh once
// everything has settled -- exercises the reference-counted pending-
// mutation map, the same-item seq fence, and refresh-vs-refresh ordering
// together in one realistic sequence.
describe("ShopCartProvider pending mutation cleanup", () => {
  it("keeps protection through three requests and a rejection, then permits a later refresh", async () => {
    const initial = cartWithQuantity(1);
    const older = deferred<CartResult>();
    const rejected = deferred<CartResult>();
    const newest = deferred<CartResult>();
    const staleRefresh = deferred<CartResult>();

    getCart
      .mockResolvedValueOnce({ data: initial, guestToken: null, clearGuestToken: false })
      .mockReturnValueOnce(staleRefresh.promise)
      .mockResolvedValueOnce({ data: cartWithQuantity(5), guestToken: null, clearGuestToken: false });
    updateCartItem.mockImplementation((_token: string | null, _itemId: number, quantity: number) => {
      if (quantity === 2) return older.promise;
      if (quantity === 3) return rejected.promise;
      return newest.promise;
    });

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, updateItem, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void updateItem(41, 2)}>قدیمی</button>
          <button type="button" onClick={() => void updateItem(41, 3).catch(() => undefined)}>ردشده</button>
          <button type="button" onClick={() => void updateItem(41, 4)}>جدیدترین</button>
          <button type="button" onClick={() => void refresh()}>بازخوانی</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "قدیمی" }));
      fireEvent.click(screen.getByRole("button", { name: "ردشده" }));
      fireEvent.click(screen.getByRole("button", { name: "جدیدترین" }));
      await Promise.resolve();
    });

    await act(async () => {
      older.resolve({ data: cartWithQuantity(2), guestToken: null, clearGuestToken: false });
      await older.promise;
    });
    await act(async () => {
      rejected.reject(new Error("simulated mutation outage"));
      await rejected.promise.catch(() => undefined);
    });

    // One newer request is still pending; refresh must capture item 41 as
    // excluded even though two sibling requests have already settled.
    fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
    await act(async () => {
      newest.resolve({ data: cartWithQuantity(4), guestToken: null, clearGuestToken: false });
      await newest.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("4");

    await act(async () => {
      staleRefresh.resolve({ data: cartWithQuantity(1), guestToken: null, clearGuestToken: false });
      await staleRefresh.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("4");

    // Once every mutation has settled, a later independent refresh must be
    // allowed to reconcile the server-authoritative value.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("5"));
  });
});
