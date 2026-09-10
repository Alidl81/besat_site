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
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-SAME-ITEM-RESPONSE-ORDER-001 +
// FE-SHOP-CART-CONTEXT-REFRESH-RACE-001: adjacent follow-ups to
// FE-SHOP-CART-CONTEXT-RESPONSE-ORDER-001. mergeSingleItemResponse alone
// only fenced *different* items from clobbering each other; it didn't
// order two responses for the *same* item, and refresh() still did an
// unconditional full-cart replacement with no fence against a stale GET
// landing after an accepted mutation. Fixed with a per-item call-time
// sequence number (updateItem/removeItem) plus a call-time-captured
// in-flight-mutation exclusion set (refresh()) -- see cart-context.tsx's
// own comments on mergeSingleItemResponse and mergeRefreshResult for the
// full reasoning.
describe("ShopCartProvider same-item and refresh response ordering", () => {
  it("keeps a newer accepted quantity when an older same-item response arrives later", async () => {
    const initial = cartWithQuantity(1);
    const older = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    const newer = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    getCart.mockResolvedValue({ data: initial, guestToken: null, clearGuestToken: false });
    updateCartItem.mockImplementation((_token: string | null, _itemId: number, quantity: number) =>
      quantity === 2 ? older.promise : newer.promise,
    );

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, updateItem } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => updateItem(41, 2)}>درخواست قدیمی</button>
          <button type="button" onClick={() => updateItem(41, 3)}>درخواست جدید</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "درخواست قدیمی" }));
      fireEvent.click(screen.getByRole("button", { name: "درخواست جدید" }));
      await Promise.resolve();
    });
    expect(updateCartItem).toHaveBeenCalledTimes(2);

    await act(async () => {
      newer.resolve({ data: cartWithQuantity(3), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");

    await act(async () => {
      older.resolve({ data: cartWithQuantity(2), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    // The older, later-arriving response must not regress the already
    // newer-accepted quantity.
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");
  });

  it("keeps an accepted item mutation when a slower refresh response arrives later", async () => {
    const initial = cartWithQuantity(1);
    const refreshResponse = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    const updateResponse = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    getCart
      .mockResolvedValueOnce({ data: initial, guestToken: null, clearGuestToken: false })
      .mockReturnValueOnce(refreshResponse.promise);
    updateCartItem.mockReturnValue(updateResponse.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, updateItem, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => updateItem(41, 2)}>تغییر تعداد</button>
          <button type="button" onClick={() => refresh()}>بازخوانی</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تغییر تعداد" }));
      fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));
      await Promise.resolve();
    });
    expect(updateCartItem).toHaveBeenCalledTimes(1);
    expect(getCart).toHaveBeenCalledTimes(2);

    await act(async () => {
      updateResponse.resolve({ data: cartWithQuantity(2), guestToken: null, clearGuestToken: false });
      await updateResponse.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("2");

    await act(async () => {
      refreshResponse.resolve({ data: cartWithQuantity(1), guestToken: null, clearGuestToken: false });
      await refreshResponse.promise;
    });

    // The stale refresh response (issued before the mutation was applied
    // server-side) must not regress the already-accepted quantity.
    expect(screen.getByTestId("item-41")).toHaveTextContent("2");
  });

  // FE-SHOP-CART-CONTEXT-MULTI-MUTATION-REFRESH-RACE-001: a plain Set only
  // tracked whether an item had *a* mutation in flight, not *how many* --
  // when the older of two overlapping same-item mutations settles first,
  // its `finally` deleted the item from the Set even though the newer
  // mutation was still pending, so a refresh() issued right after no
  // longer excluded that item and could regress it once its stale
  // response arrived. Fixed with a reference count (increment per call,
  // decrement in `finally`, only removed once it reaches zero).
  it("keeps a newer same-item mutation excluded from refresh while an older sibling mutation is still settling", async () => {
    const initial = cartWithQuantity(1);
    const older = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    const newer = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();
    const refreshResponse = deferred<{ data: ReturnType<typeof cartWithQuantity>; guestToken: string | null; clearGuestToken: boolean }>();

    getCart
      .mockResolvedValueOnce({ data: initial, guestToken: null, clearGuestToken: false })
      .mockReturnValueOnce(refreshResponse.promise);
    updateCartItem.mockImplementation((_token: string | null, _itemId: number, quantity: number) =>
      quantity === 2 ? older.promise : newer.promise,
    );

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, updateItem, refresh } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => updateItem(41, 2)}>درخواست قدیمی</button>
          <button type="button" onClick={() => updateItem(41, 3)}>درخواست جدید</button>
          <button type="button" onClick={() => refresh()}>بازخوانی</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "درخواست قدیمی" }));
      fireEvent.click(screen.getByRole("button", { name: "درخواست جدید" }));
      await Promise.resolve();
    });

    // Older mutation's response is rejected by the same-item sequence
    // watermark, but its `finally` must not clear the item's pending-count
    // entry while the newer mutation is still outstanding.
    await act(async () => {
      older.resolve({ data: cartWithQuantity(2), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    fireEvent.click(screen.getByRole("button", { name: "بازخوانی" }));

    await act(async () => {
      newer.resolve({ data: cartWithQuantity(3), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");

    await act(async () => {
      refreshResponse.resolve({ data: cartWithQuantity(1), guestToken: null, clearGuestToken: false });
      await refreshResponse.promise;
    });

    // The stale refresh response must not regress the already-accepted
    // quantity from the newer mutation.
    expect(screen.getByTestId("item-41")).toHaveTextContent("3");
  });
});
