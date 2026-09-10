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

type CartLineItem = {
  id: number;
  product: {
    id: number;
    title: string;
    slug: string;
    product_type: "physical";
    featured_image: null;
  };
  variant: null;
  variant_title: null;
  quantity: number;
  unit_price_amount: number;
  unit_price_display: string;
  line_total_amount: number;
  line_total_display: string;
  issue: null;
};

type CartData = {
  id: number;
  items: CartLineItem[];
  item_count: number;
  subtotal_amount: number;
  subtotal_display: string;
  requires_shipping: boolean;
  has_blocking_issue: boolean;
};

function emptyCart(): CartData {
  return {
    id: 1,
    items: [],
    item_count: 0,
    subtotal_amount: 0,
    subtotal_display: "",
    requires_shipping: false,
    has_blocking_issue: false,
  };
}

function cartWithItem({ id, productId, quantity }: { id: number; productId: number; quantity: number }): CartData {
  const item: CartLineItem = {
    id,
    product: {
      id: productId,
      title: `کتاب ${productId}`,
      slug: `book-${productId}`,
      product_type: "physical",
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
  data: CartData;
  guestToken: string | null;
  clearGuestToken: boolean;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-ADD-REFRESH-RACE-001: the provider's lazy initial
// refresh is a full-cart GET, while addItem() is a targeted mutation. The
// refresh exclusion map only ever tracked update/remove (keyed by an
// itemId that doesn't exist yet for an in-flight add), so a stale initial
// snapshot that settles after a successful add erased that add. Fixed by
// having mergeRefreshResult unconditionally preserve any item present
// locally but missing from the refresh's incoming snapshot.
describe("ShopCartProvider add versus refresh ordering", () => {
  it("does not let a stale initial refresh erase a successful add", async () => {
    const initialRefresh = deferred<CartResult>();
    getCart.mockReturnValueOnce(initialRefresh.promise);
    addCartItem.mockResolvedValue({
      data: cartWithItem({ id: 42, productId: 42, quantity: 1 }),
      guestToken: null,
      clearGuestToken: false,
    });

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, addItem } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void addItem(42)}>افزودن</button>
          <output data-testid="cart-items">{cart?.items.map((item) => item.product.id).join(",") ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن" }));
      await Promise.resolve();
    });
    expect(screen.getByTestId("cart-items")).toHaveTextContent("42");

    await act(async () => {
      initialRefresh.resolve({ data: emptyCart(), guestToken: null, clearGuestToken: false });
      await initialRefresh.promise;
    });

    // The initial snapshot was issued before the add and must not erase the
    // mutation that the user already saw succeed.
    expect(screen.getByTestId("cart-items")).toHaveTextContent("42");
  });
});

// FE-SHOP-CART-CONTEXT-ADD-SAME-PRODUCT-RESPONSE-ORDER-001: add responses
// are identified by product/variant rather than an item id. For two
// concurrent adds of the same product, replacing that shared line still
// needs a call-time sequence fence (the same `itemSeq` map
// mergeSingleItemResponse uses); otherwise a lower-quantity older
// snapshot can overwrite the newer quantity response.
describe("ShopCartProvider same-product add ordering", () => {
  it("does not let an older same-product add response regress quantity", async () => {
    const older = deferred<CartResult>();
    const newer = deferred<CartResult>();
    getCart.mockResolvedValueOnce({ data: emptyCart(), guestToken: null, clearGuestToken: false });
    addCartItem.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");
    function Probe() {
      const { cart, addItem } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => void addItem(41)}>افزودن اول</button>
          <button type="button" onClick={() => void addItem(41)}>افزودن دوم</button>
          <output data-testid="item-41">{cart?.items[0]?.quantity ?? ""}</output>
        </>
      );
    }

    render(<ShopCartProvider><Probe /></ShopCartProvider>);
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent(""));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن اول" }));
      fireEvent.click(screen.getByRole("button", { name: "افزودن دوم" }));
      await Promise.resolve();
    });
    expect(addCartItem).toHaveBeenCalledTimes(2);

    await act(async () => {
      newer.resolve({ data: cartWithItem({ id: 101, productId: 41, quantity: 2 }), guestToken: null, clearGuestToken: false });
      await newer.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("2");

    await act(async () => {
      older.resolve({ data: cartWithItem({ id: 101, productId: 41, quantity: 1 }), guestToken: null, clearGuestToken: false });
      await older.promise;
    });

    expect(screen.getByTestId("item-41")).toHaveTextContent("2");
  });
});
