import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PageMotion } from "@/components/layout/page-motion";
import { CartAnnouncer } from "@/components/shop/cart-announcer";
import { ShopCartProvider } from "@/lib/shop/cart-context";
import type { ReactNode } from "react";

type PublicPageLayoutProps = {
  children: ReactNode;
};

export function PublicPageLayout({ children }: PublicPageLayoutProps) {
  return (
    <ShopCartProvider>
      <div className="flex min-h-dvh flex-col overflow-x-clip">
        <SiteHeader />
        <PageMotion>{children}</PageMotion>
        <SiteFooter />
      </div>
      <CartAnnouncer />
    </ShopCartProvider>
  );
}
