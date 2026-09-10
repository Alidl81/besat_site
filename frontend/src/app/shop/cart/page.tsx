import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { CartPageView } from "@/components/shop/cart-page-view";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "سبد خرید | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

// Per-session cart state -- must not be statically generated as one shared page.
export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <PublicPageLayout>
      <Container className="py-8">
        <CartPageView />
      </Container>
    </PublicPageLayout>
  );
}
