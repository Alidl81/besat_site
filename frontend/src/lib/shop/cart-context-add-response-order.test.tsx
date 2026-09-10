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

function cartWithItems(ids: number[]) {
  const items = ids.map((id) => ({
    id,
    product: {
      id,
      title: `کتاب ${id}`,
      slug: `book-${id}`,
      product_type: "physical" as const,
      featured_image: null,
    },
    variant: null,
    variant_title: null,
    quantity: 1,
    unit_price_amount: 1000,
    unit_price_display: "۱٬۰۰۰ تومان",
    line_total_amount: 1000,
    line_total_display: "۱٬۰۰۰ تومان",
    issue: null,
  }));
  return {
    id: 1,
    items,
    item_count: items.length,
    subtotal_amount: items.length * 1000,
    subtotal_display: "",
    requires_shipping: items.length > 0,
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

// FE-SHOP-CART-CONTEXT-ADD-RESPONSE-ORDER-001: addItem() had the same
// unconditional-full-replace shape as the other cart mutations before
// their fixes -- two concurrent adds of different products are legitimate,
// but each response is a full-cart snapshot, so whichever landed last
// silently erased the other add. Fixed by merging only the specific item
// each addItem call is responsible for (identified by product/variant,
// since the item id doesn't exist until the response creates it), and
// inserting new items in call order (not response-arrival order) so the
// resulting list matches what the user actually did.
describe("ShopCartProvider add-item response ordering", () => {
  it("does not lose one concurrent add when the older full-cart response arrives last", async () => {
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    getCart.mockResolvedValueOnce({ data: cartWithItems([]), guestToken: null, clearGuestToken: false });
    addCartItem.mockImplementation((_token: string | null, payload: { product_id: number }) =>
      payload.product_id === 41 ? older.promise : newer.promise,
    );

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, addItem } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void addItem(41)}>افزودن ۴۱</button>
          <button type="button" onClick={() => void addItem(42)}>افزودن ۴۲</button>
          <output data-testid="cart-items">{cart?.items.map((item) => item.product.id).join(",") ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("cart-items")).toHaveTextContent(""));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن ۴۱" }));
      fireEvent.click(screen.getByRole("button", { name: "افزودن ۴۲" }));
      await Promise.resolve();
    });
    expect(addCartItem).toHaveBeenCalledTimes(2);

    await act(async () => {
      newer.resolve({ data: cartWithItems([42]), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("cart-items")).toHaveTextContent("42");

    await act(async () => {
      older.resolve({ data: cartWithItems([41]), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    // Both user adds succeeded; an older full snapshot must not erase the
    // item represented by the newer response, and the result must reflect
    // the order the user actually clicked in (41 then 42), not response
    // arrival order.
    expect(screen.getByTestId("cart-items")).toHaveTextContent("41,42");
  });
});
