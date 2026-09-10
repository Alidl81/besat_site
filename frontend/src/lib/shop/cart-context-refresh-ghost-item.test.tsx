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
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function cartWithItem() {
  return {
    id: 1,
    items: [{
      id: 41,
      product: { id: 41, title: "کتاب ۴۱", slug: "book-41", product_type: "physical" as const, featured_image: null },
      variant: null,
      variant_title: null,
      quantity: 1,
      unit_price_amount: 1000,
      unit_price_display: "۱٬۰۰۰ تومان",
      line_total_amount: 1000,
      line_total_display: "۱٬۰۰۰",
      issue: null,
    }],
    item_count: 1,
    subtotal_amount: 1000,
    subtotal_display: "۱٬۰۰۰ تومان",
    requires_shipping: true,
    has_blocking_issue: false,
  };
}

function emptyCart() {
  return { id: 1, items: [], item_count: 0, subtotal_amount: 0, subtotal_display: "", requires_shipping: false, has_blocking_issue: false };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-REFRESH-GHOST-ITEM-001: the add-vs-refresh race fix
// (mergeRefreshResult unconditionally preserving any locally-known item
// missing from a refresh's snapshot) went too far -- it also preserved an
// item the server had legitimately dropped, even with no mutation racing
// at all, turning every refresh into a one-way ratchet that could add
// items but never let a plain, uncontested refresh remove one. Fixed by
// gating that preservation on itemSeq: an item with no seq entry (never
// touched by a targeted mutation, e.g. it only ever came from an earlier
// refresh) always loses to a fresher refresh's absence.
describe("ShopCartProvider refresh reconciliation", () => {
  it("removes an item that the authoritative refresh no longer returns", async () => {
    const laterRefresh = deferred<{ data: ReturnType<typeof emptyCart>; guestToken: null; clearGuestToken: false }>();
    getCart
      .mockResolvedValueOnce({ data: cartWithItem(), guestToken: null, clearGuestToken: false })
      .mockReturnValueOnce(laterRefresh.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, refresh } = useShopCart();
      return <>
        <button type="button" onClick={() => void refresh()}>تازه‌سازی</button>
        <output data-testid="cart-items">{cart?.items.map((item) => item.product.id).join(",") ?? ""}</output>
      </>;
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("cart-items")).toHaveTextContent("41"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تازه‌سازی" }));
      await Promise.resolve();
    });
    expect(getCart).toHaveBeenCalledTimes(2);

    await act(async () => {
      laterRefresh.resolve({ data: emptyCart(), guestToken: null, clearGuestToken: false });
      await laterRefresh.promise;
    });

    expect(screen.getByTestId("cart-items")).toBeEmptyDOMElement();
  });
});
