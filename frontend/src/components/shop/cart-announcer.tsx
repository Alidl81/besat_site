"use client";

import { useShopCart } from "@/lib/shop/cart-context";

export function CartAnnouncer() {
  const { announcement } = useShopCart();
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {announcement}
    </div>
  );
}
