import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { OrderDetailView } from "@/components/shop/order-detail-view";

export const metadata: Metadata = {
  title: "سفارش من | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <Container className="py-8">
      <OrderDetailView orderNumber={decodeURIComponent(orderNumber)} />
    </Container>
  );
}
