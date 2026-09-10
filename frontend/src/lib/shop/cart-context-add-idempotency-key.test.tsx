import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, addCartItem } = vi.hoisted(() => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

vi.mock("@/services/shop-service", () => ({
  getCart,
  addCartItem,
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

// REL-FE-CART-ADD-RESPONSE-LOSS-001: unlike DELETE, an add-to-cart POST is
// not naturally idempotent -- a lost response followed by the user
// clicking "Add to Cart" again for the same product is indistinguishable,
// from the request alone, from a genuine second add. addItem() now reuses
// the same client_request_id across a failed attempt and its retry for
// the same product/variant, and only rotates to a fresh key once an
// attempt actually succeeds.
describe("ShopCartProvider addItem idempotency key", () => {
  it("reuses the same client_request_id when a retry follows a failed add for the same product", async () => {
    getCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });
    addCartItem.mockRejectedValueOnce(new Error("response lost"));
    addCartItem.mockResolvedValueOnce({ data: emptyCart(), guestToken: null, clearGuestToken: false });

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    function Probe() {
      const { addItem } = useShopCart();
      return (
        <button type="button" onClick={() => addItem(7, 1, null).catch(() => undefined)}>
          افزودن
        </button>
      );
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));

    const button = screen.getByRole("button", { name: "افزودن" });
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(addCartItem).toHaveBeenCalledTimes(2);
    const firstKey = addCartItem.mock.calls[0][1].client_request_id;
    const secondKey = addCartItem.mock.calls[1][1].client_request_id;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it("uses a fresh client_request_id for a genuinely new add after a successful one", async () => {
    getCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });
    addCartItem.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    function Probe() {
      const { addItem } = useShopCart();
      return (
        <button type="button" onClick={() => addItem(7, 1, null)}>
          افزودن
        </button>
      );
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));

    const button = screen.getByRole("button", { name: "افزودن" });
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(addCartItem).toHaveBeenCalledTimes(2);
    const firstKey = addCartItem.mock.calls[0][1].client_request_id;
    const secondKey = addCartItem.mock.calls[1][1].client_request_id;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  // REL-FE-CART-ADD-IDEMPOTENCY-RELOAD-001: addRequestIdsRef alone is
  // pure in-memory state -- a page reload (simulated here by unmounting
  // and mounting a completely fresh ShopCartProvider instance, which
  // gets its own fresh, empty ref) between a failed add and its retry
  // used to lose the key entirely, minting a new one and letting the
  // retry double-add. localStorage persistence must let the fresh
  // instance rehydrate the still-pending key instead.
  it("reuses the same client_request_id across a provider remount (page reload) after a failed add", async () => {
    getCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });
    addCartItem.mockRejectedValueOnce(new Error("response lost"));
    addCartItem.mockResolvedValueOnce({ data: emptyCart(), guestToken: null, clearGuestToken: false });

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    function Probe() {
      const { addItem } = useShopCart();
      return (
        <button type="button" onClick={() => addItem(7, 1, null).catch(() => undefined)}>
          افزودن
        </button>
      );
    }

    const first = render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));
    await act(async () => {
      screen.getByRole("button", { name: "افزودن" }).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(addCartItem).toHaveBeenCalledTimes(1);

    // Simulate a page reload: tear down the failed attempt's provider
    // instance entirely and mount a brand-new one -- its addRequestIdsRef
    // starts empty, exactly like a fresh page load would.
    first.unmount();
    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(2));
    await act(async () => {
      screen.getByRole("button", { name: "افزودن" }).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(addCartItem).toHaveBeenCalledTimes(2);
    const firstKey = addCartItem.mock.calls[0][1].client_request_id;
    const secondKey = addCartItem.mock.calls[1][1].client_request_id;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });
});
