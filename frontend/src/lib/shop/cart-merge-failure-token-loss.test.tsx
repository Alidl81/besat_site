import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mergeGuestCartMock } = vi.hoisted(() => ({ mergeGuestCartMock: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/services/shop-service", () => ({
  addCartItem: vi.fn(),
  getCart: vi.fn(),
  mergeGuestCart: mergeGuestCartMock,
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

import { mergeGuestCartAfterAuth, ShopCartProvider, useShopCart } from "@/lib/shop/cart-context";

// FE-SHOP-GUEST-CART-MERGE-FAILURE-001: both mergeGuestCartAfterAuth() and
// the provider's mergeAfterLogin() unconditionally cleared the guest-cart
// token in their catch block, even on a purely transient merge failure
// (network blip, 500). The token is the only client handle for that
// guest cart -- discarding it on failure permanently strands those items,
// since nothing can retry the merge without it. Both now leave the token
// in place on failure.
describe("guest cart merge failure recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mergeGuestCartMock.mockReset();
    window.localStorage.setItem("besat_guest_cart_token", "guest-token-qa");
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("must retain the guest-cart token when the standalone merge transport fails", async () => {
    mergeGuestCartMock.mockRejectedValue(new Error("temporary merge outage"));

    await mergeGuestCartAfterAuth();

    // A failed merge did not prove that the server cart was consumed. The
    // token is the only client handle for the guest cart and must remain so
    // a retry can recover the items after authentication.
    expect(window.localStorage.getItem("besat_guest_cart_token")).toBe("guest-token-qa");
  });

  it("must retain the guest-cart token when the provider's mergeAfterLogin fails", async () => {
    mergeGuestCartMock.mockRejectedValue(new Error("temporary merge outage"));

    function Probe() {
      const { mergeAfterLogin } = useShopCart();
      return <button type="button" onClick={() => void mergeAfterLogin()}>merge</button>;
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "merge" }).click();
      await waitFor(() => expect(mergeGuestCartMock).toHaveBeenCalledTimes(1));
    });

    expect(window.localStorage.getItem("besat_guest_cart_token")).toBe("guest-token-qa");
  });
});
