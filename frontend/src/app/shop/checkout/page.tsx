import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "تسویه حساب | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

// Per-session cart/checkout state -- must not be statically generated as one shared page.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <PublicPageLayout>
      <CheckoutView />
    </PublicPageLayout>
  );
}
