"use client";

import Link from "next/link";
import { CrudSection, EmptyState, StatusBadge } from "@/components/crud/crud-ui";
import { PanelError } from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { formatPrice } from "@/lib/shop/money";
import { getMyOrders } from "@/services/shop-account-service";

export function ParentOrdersManager() {
  const { data, loading, error, reload } = usePanelRequest(() => getMyOrders(), []);
  const orders = data?.results ?? [];

  return (
    <CrudSection title="سفارش‌های فروشگاه" description="سفارش‌ها و فاکتورهای خرید شما از فروشگاه بعثت">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        // FE-PANEL-PARENT-ADDRESSES-ERROR-RETRY-001: see
        // parent-addresses-manager.tsx -- identical no-retry defect, same
        // shared PanelError fix.
        <PanelError message={error} onRetry={reload} />
      ) : orders.length === 0 ? (
        <EmptyState text="تاکنون سفارشی ثبت نکرده‌اید." />
      ) : (
        <div className="panel-table-scroll">
          {/* panel-table-scroll (globals.css) -- see
              FE-DASH-RTL-TABLE-ROOT-OVERFLOW-001 and
              FE-DASH-RTL-TABLE-MOBILE-AFFORDANCE-001 in
              shop-orders-manager.tsx: isolates this wrapper's overflowing
              RTL table content from contributing to root-level
              documentElement.scrollWidth, and fades in an edge cue when the
              status/action columns start outside the visible area. */}
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>شماره سفارش</th>
                <th>تعداد اقلام</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                {/* FE-DASH-RTL-SHOP-ORDER-ACTION-001: same sticky-column fix
                    as shop-orders-manager.tsx (identical table shape) --
                    the edge-cue fade alone still left the sole row action
                    entirely outside the visible RTL wrapper at 390px. */}
                <th className="panel-table-action-sticky"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_number}>
                  <td dir="ltr" className="text-left font-mono text-xs">{order.order_number}</td>
                  <td>{new Intl.NumberFormat("fa-IR").format(order.item_count)}</td>
                  <td>{formatPrice(order.total_amount)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="panel-table-action-sticky">
                    <Link
                      href={`/dashboard/parents/shop/orders/${order.order_number}`}
                      className="panel-text-link text-xs"
                    >
                      مشاهده جزئیات
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrudSection>
  );
}
