import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Container } from "@/components/shared/container";
import { MockPaymentGateway } from "@/components/shop/mock-payment-gateway";

export const metadata: Metadata = {
  title: "درگاه پرداخت آزمایشی | فروشگاه بعثت",
  robots: { index: false, follow: false },
};

export default async function MockPaymentPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  return (
    <Suspense
      fallback={
        <Container className="flex min-h-[70vh] items-center justify-center">
          <Loader2 aria-hidden="true" className="size-6 animate-spin text-[#0a2848]/40" />
        </Container>
      }
    >
      <MockPaymentGateway attemptId={Number(attemptId)} />
    </Suspense>
  );
}
