"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CrudSection } from "@/components/crud/crud-ui";
import { OrderDetailView } from "@/components/shop/order-detail-view";

/**
 * DashboardShell drives content purely by a static sectionKey, with no
 * slot for passing a dynamic route param down -- so this reads the order
 * number directly from the URL via useParams() instead of needing any
 * change to that shared shell.
 */
export function ParentOrderDetailManager() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(params.orderNumber ?? "");

  return (
    <CrudSection
      title={orderNumber || "جزئیات سفارش"}
      action={
        <Link
          href="/dashboard/parents/shop/orders"
          className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:underline"
        >
          <ChevronRight aria-hidden="true" className="size-3.5" />
          بازگشت به سفارش‌ها
        </Link>
      }
    >
      {orderNumber ? <OrderDetailView orderNumber={orderNumber} /> : null}
    </CrudSection>
  );
}
