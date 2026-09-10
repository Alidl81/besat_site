import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, removeCartItem } = vi.hoisted(() => ({
  getCart: vi.fn(),
  removeCartItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

vi.mock("@/services/shop-service", () => ({
  getCart,
  removeCartItem,
  addCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

function cartWithItem(present: boolean) {
  const items = present
    ? [
        {
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
          quantity: 1,
          unit_price_amount: 1000,
          unit_price_display: "۱٬۰۰۰ تومان",
          line_total_amount: 1000,
          line_total_display: "۱٬۰۰۰ تومان",
          issue: null,
        },
      ]
    : [];
  return {
    id: 1,
    items,
    item_count: items.length,
    subtotal_amount: items.length * 1000,
    subtotal_display: "",
    requires_shipping: false,
    has_blocking_issue: false,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// REL-FE-CART-DELETE-RESPONSE-LOSS-001: a DELETE can commit on the server
// while its response is lost in transit (a network drop, a proxy 503) --
// the client sees a rejection even though the item is already gone
// server-side, and (whether from this same rejection or a subsequent
// retry that correctly gets item_not_found) removeItem() used to just
// surface that as a persistent error while the item stayed visibly stuck
// in the UI, even though a direct cart GET would show it's already gone.
describe("ShopCartProvider removeItem response-loss reconciliation", () => {
  it("treats a remove failure as success once a reconciling GET confirms the item is actually gone", async () => {
    getCart
      .mockResolvedValueOnce({ data: cartWithItem(true), guestToken: null, clearGuestToken: false })
      // The reconciling GET issued from inside removeItem()'s catch block.
      .mockResolvedValueOnce({ data: cartWithItem(false), guestToken: null, clearGuestToken: false });
    removeCartItem.mockRejectedValue(new Error("item_not_found"));

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    let captured: unknown;
    let settled = false;
    function Probe() {
      const { cart, removeItem } = useShopCart();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              removeItem(41)
                .catch((reason) => {
                  captured = reason;
                })
                .finally(() => {
                  settled = true;
                });
            }}
          >
            حذف
          </button>
          <output data-testid="item-count">{cart?.items.length ?? ""}</output>
        </>
      );
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("item-count")).toHaveTextContent("1"));

    await act(async () => {
      screen.getByRole("button", { name: "حذف" }).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(settled).toBe(true);
    expect(captured).toBeUndefined();
    expect(getCart).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("item-count")).toHaveTextContent("0");
  });

  it("still surfaces the original error when the reconciling GET shows the item genuinely still present", async () => {
    getCart.mockResolvedValue({ data: cartWithItem(true), guestToken: null, clearGuestToken: false });
    const genuineError = new Error("network unreachable");
    removeCartItem.mockRejectedValue(genuineError);

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    let captured: unknown;
    function Probe() {
      const { cart, removeItem } = useShopCart();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              removeItem(41).catch((reason) => {
                captured = reason;
              });
            }}
          >
            حذف
          </button>
          <output data-testid="item-count">{cart?.items.length ?? ""}</output>
        </>
      );
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("item-count")).toHaveTextContent("1"));

    await act(async () => {
      screen.getByRole("button", { name: "حذف" }).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(captured).toBe(genuineError);
    // The item genuinely never left the (reconciled) server cart, so the
    // local state must still show it -- not silently clear it.
    expect(screen.getByTestId("item-count")).toHaveTextContent("1");
  });
});
