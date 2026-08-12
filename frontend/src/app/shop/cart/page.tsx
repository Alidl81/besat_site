import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { CartPageView } from "@/components/shop/cart-page-view";

export const metadata: Metadata = {
  title: "سبد خرید | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <Container className="py-8">
      <CartPageView />
    </Container>
  );
}
