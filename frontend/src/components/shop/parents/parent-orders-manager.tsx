"use client";

import Link from "next/link";
import { CrudSection, EmptyState, StatusBadge } from "@/components/crud/crud-ui";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { formatPrice } from "@/lib/shop/money";
import { getMyOrders } from "@/services/shop-account-service";

export function ParentOrdersManager() {
  const { data, loading, error } = usePanelRequest(() => getMyOrders(), []);
  const orders = data?.results ?? [];

  return (
    <CrudSection title="سفارش‌های فروشگاه" description="سفارش‌ها و فاکتورهای خرید شما از فروشگاه بعثت">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : orders.length === 0 ? (
        <EmptyState text="تاکنون سفارشی ثبت نکرده‌اید." />
      ) : (
        <div className="overflow-x-auto">
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>شماره سفارش</th>
                <th>تعداد اقلام</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_number}>
                  <td dir="ltr" className="text-left font-mono text-xs">{order.order_number}</td>
                  <td>{new Intl.NumberFormat("fa-IR").format(order.item_count)}</td>
                  <td>{formatPrice(order.total_amount)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>
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
