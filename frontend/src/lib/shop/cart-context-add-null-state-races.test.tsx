import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, addCartItem } = vi.hoisted(() => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/shop" }));
vi.mock("@/services/shop-service", () => ({
  getCart,
  addCartItem,
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function cartWithItems(items: Array<{ id: number; productId: number; quantity: number }>) {
  const mapped = items.map(({ id, productId, quantity }) => ({
    id,
    product: {
      id: productId,
      title: `کتاب ${productId}`,
      slug: `book-${productId}`,
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
  }));
  return {
    id: 1,
    items: mapped,
    item_count: mapped.reduce((sum, item) => sum + item.quantity, 0),
    subtotal_amount: mapped.reduce((sum, item) => sum + item.line_total_amount, 0),
    subtotal_display: "",
    requires_shipping: true,
    has_blocking_issue: false,
  };
}

type CartResult = {
  data: ReturnType<typeof cartWithItems>;
  guestToken: string | null;
  clearGuestToken: boolean;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-ADD-NULL-STATE-ORDER-001: mergeAddedItemResponse
// used to bypass all of its seq-recording/ordering logic with an early
// `if (!current) return incoming` whenever an add's response arrived
// before the provider's lazy initial refresh had resolved (`cart` still
// `null`). That meant the very first add response in a session recorded
// no ordering information at all, so a second concurrent add (same or
// different product) had nothing to compare against. Treating `null` as
// an empty cart shell instead of short-circuiting fixes this.
describe("ShopCartProvider add races before initial cart state exists", () => {
  it("preserves call-time ordering for same-product responses when current cart is null", async () => {
    const initialRefresh = deferred<CartResult>();
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    getCart.mockReturnValueOnce(initialRefresh.promise);
    addCartItem.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, addItem } = useShopCart();
      return <>
        <button type="button" onClick={() => void addItem(41)}>افزودن اول</button>
        <button type="button" onClick={() => void addItem(41)}>افزودن دوم</button>
        <output data-testid="item-41">{cart?.items.find((item) => item.product.id === 41)?.quantity ?? ""}</output>
      </>;
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن اول" }));
      fireEvent.click(screen.getByRole("button", { name: "افزودن دوم" }));
      await Promise.resolve();
    });

    await act(async () => {
      newer.resolve({ data: cartWithItems([{ id: 101, productId: 41, quantity: 2 }]), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    await act(async () => {
      older.resolve({ data: cartWithItems([{ id: 101, productId: 41, quantity: 1 }]), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    expect(screen.getByTestId("item-41")).toHaveTextContent("2");
    await act(async () => { initialRefresh.resolve({ data: cartWithItems([]), guestToken: null, clearGuestToken: false }); await initialRefresh.promise; });
  });

  it("keeps different-product adds in call order even when the first applied response starts from null", async () => {
    const initialRefresh = deferred<CartResult>();
    const first = deferred<CartResult>();
    const second = deferred<CartResult>();
    getCart.mockReturnValueOnce(initialRefresh.promise);
    addCartItem.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, addItem } = useShopCart();
      return <>
        <button type="button" onClick={() => void addItem(41)}>افزودن ۴۱</button>
        <button type="button" onClick={() => void addItem(42)}>افزودن ۴۲</button>
        <output data-testid="cart-items">{cart?.items.map((item) => item.product.id).join(",") ?? ""}</output>
      </>;
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن ۴۱" }));
      fireEvent.click(screen.getByRole("button", { name: "افزودن ۴۲" }));
      await Promise.resolve();
    });
    await act(async () => {
      second.resolve({ data: cartWithItems([{ id: 102, productId: 42, quantity: 1 }]), guestToken: null, clearGuestToken: false });
      await second.promise;
    });
    await act(async () => {
      first.resolve({ data: cartWithItems([{ id: 101, productId: 41, quantity: 1 }]), guestToken: null, clearGuestToken: false });
      await first.promise;
    });

    expect(screen.getByTestId("cart-items")).toHaveTextContent("41,42");
    await act(async () => { initialRefresh.resolve({ data: cartWithItems([]), guestToken: null, clearGuestToken: false }); await initialRefresh.promise; });
  });
});
