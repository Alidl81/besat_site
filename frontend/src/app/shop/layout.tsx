import type { ReactNode } from "react";
import { CartAnnouncer } from "@/components/shop/cart-announcer";
import { CartWidget } from "@/components/shop/cart-drawer";
import { ShopCartProvider } from "@/lib/shop/cart-context";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopCartProvider>
      <div dir="rtl" className="sticky top-[62px] z-40 border-b border-[#e5e7eb] bg-white/95 backdrop-blur xl:top-0">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <span className="text-xs font-black text-[#0a2848]/60">فروشگاه بعثت</span>
          <CartWidget />
        </div>
      </div>
      <CartAnnouncer />
      {children}
    </ShopCartProvider>
  );
}
