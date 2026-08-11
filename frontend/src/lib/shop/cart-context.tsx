"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import { addCartItem, getCart, mergeGuestCart, removeCartItem, updateCartItem } from "@/services/shop-service";
import type { CartTransportResult } from "@/lib/shop/cart-transport";
import type { Cart } from "@/types/shop";

/**
 * The guest-cart token only identifies an anonymous shopping cart (no
 * auth capability, no PII beyond what's already in the cart) -- unlike
 * the real session tokens, it does not need to be an httpOnly cookie
 * managed by the BFF proxy. It lives in localStorage instead, which
 * turned out to need zero changes to the proxy: `backend-client.ts`
 * only strips a fixed header blocklist that doesn't include this custom
 * header in either direction (verified by reading it), so a plain
 * client-side header round-trip already works end-to-end.
 */
const GUEST_TOKEN_STORAGE_KEY = "besat_guest_cart_token";

function readGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeGuestToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, quota) -- cart still works
    // for the current tab session via in-memory state, just won't persist.
  }
}

type ShopCartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  announcement: string;
  addItem: (productId: number, quantity?: number, variantId?: number | null) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refresh: () => Promise<void>;
  mergeAfterLogin: () => Promise<void>;
};

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const applyResult = useCallback((result: CartTransportResult<Cart>) => {
    if (result.clearGuestToken) writeGuestToken(null);
    else if (result.guestToken) writeGuestToken(result.guestToken);
    setCart(result.data);
    return result.data;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyResult(await getCart(readGuestToken()));
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    Promise.resolve().then(() => refresh());
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addItem = useCallback(
    async (productId: number, quantity = 1, variantId: number | null = null) => {
      const result = await addCartItem(readGuestToken(), {
        product_id: productId,
        variant_id: variantId,
        quantity,
      });
      applyResult(result);
      setAnnouncement("محصول به سبد خرید اضافه شد.");
    },
    [applyResult],
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      const result = await updateCartItem(readGuestToken(), itemId, quantity);
      applyResult(result);
      setAnnouncement("تعداد سبد خرید به‌روزرسانی شد.");
    },
    [applyResult],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const result = await removeCartItem(readGuestToken(), itemId);
      applyResult(result);
      setAnnouncement("محصول از سبد خرید حذف شد.");
    },
    [applyResult],
  );

  const mergeAfterLogin = useCallback(async () => {
    const token = readGuestToken();
    if (!token) {
      await refresh();
      return;
    }
    try {
      applyResult(await mergeGuestCart(token));
    } catch {
      writeGuestToken(null);
      await refresh();
    }
  }, [applyResult, refresh]);

  const value = useMemo<ShopCartContextValue>(
    () => ({ cart, loading, error, announcement, addItem, updateItem, removeItem, refresh, mergeAfterLogin }),
    [cart, loading, error, announcement, addItem, updateItem, removeItem, refresh, mergeAfterLogin],
  );

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const context = useContext(ShopCartContext);
  if (!context) {
    throw new Error("useShopCart must be used within a ShopCartProvider");
  }
  return context;
}
