import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCart, mergeGuestCart } = vi.hoisted(() => ({
  getCart: vi.fn(),
  mergeGuestCart: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/shop" }));
vi.mock("@/services/shop-service", () => ({
  getCart,
  addCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  mergeGuestCart,
}));

const GUEST_TOKEN_STORAGE_KEY = "besat_guest_cart_token";

function setHasSessionCookie(present: boolean) {
  document.cookie = present
    ? "besat_has_session=1; path=/"
    : "besat_has_session=; Max-Age=0; path=/";
}

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
  setHasSessionCookie(false);
});

// FE-SHOP-GUEST-CART-MERGE-RETRY-001: a guest-cart merge attempted during
// login could fail (network blip, transient 503) -- mergeAfterLogin()/
// mergeGuestCartAfterAuth() deliberately keep the guest token in that case
// specifically so a later visit can retry it, but nothing ever actually
// retried: the /shop mount effect always called a plain refresh() (a
// GET), and get_or_create_active_cart() never merges for an authenticated
// caller -- only the dedicated merge endpoint does. So the guest cart
// silently stayed unmerged forever, and the authenticated cart rendered
// empty even though the guest cart still legitimately had items server-side.
//
// Reopened: the first fix gated the retry on readBesatSession(), a
// client-side localStorage cache only written after SiteAuthActions' own
// async getCurrentUser() call resolves -- so a shop-cart mount landing
// right after a real login redirect (before that write happened) saw no
// session and silently fell through to a plain refresh(), never retrying
// (exactly what Codex's live-browser /login -> /dashboard -> /shop/cart
// probe hit). The fix now reads besat_has_session, a cookie the server
// sets synchronously alongside the real session cookies -- nothing async
// to race -- so these tests set that cookie directly instead of mocking
// auth-session.ts's display cache at all.
describe("ShopCartProvider guest-cart merge retry on mount", () => {
  it("retries the merge (not a plain refresh) when a guest token survives into an authenticated visit", async () => {
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, "stale-guest-token");
    setHasSessionCookie(true);
    mergeGuestCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: true });

    const { ShopCartProvider } = await import("@/lib/shop/cart-context");
    await act(async () => {
      render(
        <ShopCartProvider>
          <div />
        </ShopCartProvider>,
      );
    });

    await waitFor(() => expect(mergeGuestCart).toHaveBeenCalledWith("stale-guest-token"));
    expect(getCart).not.toHaveBeenCalled();
  });

  it("does not attempt a merge for an anonymous visitor's own guest token (the common case)", async () => {
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, "anonymous-guest-token");
    setHasSessionCookie(false);
    getCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });

    const { ShopCartProvider } = await import("@/lib/shop/cart-context");
    await act(async () => {
      render(
        <ShopCartProvider>
          <div />
        </ShopCartProvider>,
      );
    });

    await waitFor(() => expect(getCart).toHaveBeenCalledWith("anonymous-guest-token"));
    expect(mergeGuestCart).not.toHaveBeenCalled();
  });

  it("does a plain refresh for an authenticated visitor with no leftover guest token", async () => {
    setHasSessionCookie(true);
    getCart.mockResolvedValue({ data: emptyCart(), guestToken: null, clearGuestToken: false });

    const { ShopCartProvider } = await import("@/lib/shop/cart-context");
    await act(async () => {
      render(
        <ShopCartProvider>
          <div />
        </ShopCartProvider>,
      );
    });

    await waitFor(() => expect(getCart).toHaveBeenCalled());
    expect(mergeGuestCart).not.toHaveBeenCalled();
  });

  // FE-SHOP-GUEST-CART-MERGE-EMPTY-FLICKER-001: mergeAfterLogin() never
  // touched `loading`, so a live probe found /shop/cart briefly rendered
  // its empty-cart heading for the ~1-1.5s the retry merge was still
  // pending, before the real line popped in once it resolved -- with
  // `cart` still null and `loading` still false, CartPageView/cart-drawer's
  // own `loading && !cart` check can't tell that state apart from a
  // genuinely empty cart.
  it("reports loading while the retried merge is still pending, and clears it once resolved", async () => {
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, "stale-guest-token");
    setHasSessionCookie(true);
    let resolveMerge!: (value: { data: ReturnType<typeof emptyCart>; guestToken: string | null; clearGuestToken: boolean }) => void;
    mergeGuestCart.mockReturnValue(
      new Promise((resolve) => {
        resolveMerge = resolve;
      }),
    );

    const { ShopCartProvider, useShopCart } = await import("@/lib/shop/cart-context");

    function Probe() {
      const { loading } = useShopCart();
      return <output data-testid="loading">{String(loading)}</output>;
    }

    render(
      <ShopCartProvider>
        <Probe />
      </ShopCartProvider>,
    );

    await waitFor(() => expect(mergeGuestCart).toHaveBeenCalledWith("stale-guest-token"));
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      resolveMerge({ data: emptyCart(), guestToken: null, clearGuestToken: true });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  });
});
