import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, updateCartItem } = vi.hoisted(() => ({
  getCart: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

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

function cartWithQuantities(first: number, second: number) {
  const item = (id: number, title: string, quantity: number) => ({
    id,
    product: {
      id,
      title,
      slug: `book-${id}`,
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
  });
  return {
    id: 1,
    items: [item(41, "کتاب اول", first), item(42, "کتاب دوم", second)],
    item_count: first + second,
    subtotal_amount: (first + second) * 1000,
    subtotal_display: "",
    requires_shipping: false,
    has_blocking_issue: false,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTEXT-RESPONSE-ORDER-001: updateItem/removeItem
// responses are full-cart snapshots. Two concurrent mutations of
// *different* items are intentionally allowed to run in parallel, but
// applyResult used to blindly replace the entire local cart with
// whichever response landed last -- so a slower response, serialized from
// a snapshot taken before the other item's update was applied, silently
// regressed that other item. Fixed by merging only the field(s) each
// specific request actually targeted (mergeSingleItemResponse) and
// recomputing the cart-level aggregates from the merged item list, so an
// out-of-order response can no longer clobber a different item's
// already-accepted update.
describe("ShopCartProvider response ordering", () => {
  it("keeps an already-accepted item update when a slower, differently-targeted response arrives later", async () => {
    const initial = cartWithQuantities(1, 1);
    const firstResponse = deferred<{ data: ReturnType<typeof cartWithQuantities>; guestToken: string | null; clearGuestToken: boolean }>();
    const secondResponse = deferred<{ data: ReturnType<typeof cartWithQuantities>; guestToken: string | null; clearGuestToken: boolean }>();
    getCart.mockResolvedValue({ data: initial, guestToken: null, clearGuestToken: false });
    updateCartItem.mockImplementation((_token: string | null, itemId: number) =>
      itemId === 41 ? firstResponse.promise : secondResponse.promise,
    );

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    function Probe() {
      const { cart, updateItem } = useShopCart();
      return (
        <>
          <button type="button" onClick={() => updateItem(41, 2)}>افزایش اول</button>
          <button type="button" onClick={() => updateItem(42, 2)}>افزایش دوم</button>
          <output data-testid="item-41">{cart?.items.find((item) => item.id === 41)?.quantity ?? ""}</output>
          <output data-testid="item-42">{cart?.items.find((item) => item.id === 42)?.quantity ?? ""}</output>
        </>
      );
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("item-41")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزایش اول" }));
      fireEvent.click(screen.getByRole("button", { name: "افزایش دوم" }));
      await Promise.resolve();
    });
    expect(updateCartItem).toHaveBeenCalledTimes(2);

    // The first request's response reflects item 41=2, item 42=1. The
    // second response was serialized from the other request's earlier
    // snapshot (item 41=1, item 42=2) and is deliberately delivered last.
    await act(async () => {
      firstResponse.resolve({ data: cartWithQuantities(2, 1), guestToken: null, clearGuestToken: false });
      await firstResponse.promise;
    });
    expect(screen.getByTestId("item-41")).toHaveTextContent("2");

    await act(async () => {
      secondResponse.resolve({ data: cartWithQuantities(1, 2), guestToken: null, clearGuestToken: false });
      await secondResponse.promise;
    });

    // Item 41's already-accepted update must survive the later, stale
    // response for item 42; item 42 picks up its own fresh value.
    expect(screen.getByTestId("item-41")).toHaveTextContent("2");
    expect(screen.getByTestId("item-42")).toHaveTextContent("2");
  });
});
