import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";

export const metadata: Metadata = {
  title: "تسویه حساب | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
