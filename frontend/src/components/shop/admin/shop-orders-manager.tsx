"use client";

import { useState } from "react";
import { CrudSection, EmptyState, Modal, Select, StatusBadge } from "@/components/crud/crud-ui";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatPrice } from "@/lib/shop/money";
import {
  cmsGetOrder,
  cmsGetOrderEvents,
  cmsGetOrders,
  cmsRunOrderAction,
  type OrderFulfillmentAction,
} from "@/services/shop-cms-service";
import type { OrderStatus } from "@/types/shop";

const ACTIONS_BY_STATUS: Partial<Record<OrderStatus, { action: OrderFulfillmentAction; label: string; needsReason?: boolean }[]>> = {
  paid: [
    { action: "mark-processing", label: "شروع پردازش" },
    { action: "mark-completed", label: "علامت‌گذاری تکمیل‌شده" },
    { action: "refund", label: "بازگشت کامل وجه", needsReason: true },
  ],
  processing: [
    { action: "mark-shipped", label: "علامت‌گذاری ارسال‌شده" },
    { action: "mark-completed", label: "علامت‌گذاری تکمیل‌شده" },
    { action: "refund", label: "بازگشت کامل وجه", needsReason: true },
  ],
  shipped: [
    { action: "mark-completed", label: "علامت‌گذاری تکمیل‌شده" },
    { action: "refund", label: "بازگشت کامل وجه", needsReason: true },
  ],
  completed: [{ action: "refund", label: "بازگشت کامل وجه", needsReason: true }],
  pending_payment: [{ action: "cancel", label: "لغو سفارش", needsReason: true }],
  payment_processing: [{ action: "cancel", label: "لغو سفارش", needsReason: true }],
};

export function ShopOrdersManager() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, error, reload } = usePanelRequest(
    () => cmsGetOrders({ status: statusFilter || undefined }),
    [statusFilter],
  );
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const orders = data?.results ?? [];

  return (
    <CrudSection
      title="سفارش‌ها"
      description="مشاهده و پردازش سفارش‌های فروشگاه"
      action={
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-44">
          <option value="">همه وضعیت‌ها</option>
          <option value="pending_payment">در انتظار پرداخت</option>
          <option value="paid">پرداخت‌شده</option>
          <option value="processing">در حال پردازش</option>
          <option value="shipped">ارسال‌شده</option>
          <option value="completed">تکمیل‌شده</option>
          <option value="cancelled">لغوشده</option>
          <option value="refunded">بازگشت وجه</option>
        </Select>
      }
    >
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : orders.length === 0 ? (
        <EmptyState text="سفارشی ثبت نشده است." />
      ) : (
        <div className="overflow-x-auto">
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>شماره سفارش</th>
                <th>مشتری</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td dir="ltr" className="text-left font-mono text-xs">{order.order_number}</td>
                  <td className="font-black">{order.user_display}</td>
                  <td>{formatPrice(order.total_amount)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>
                    <button type="button" onClick={() => setOpenOrderId(order.id)} className="panel-text-link text-xs">
                      مشاهده جزئیات
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={openOrderId !== null} onClose={() => setOpenOrderId(null)} title="جزئیات سفارش" size="lg">
        {openOrderId !== null ? (
          <OrderDetailPanel
            orderId={openOrderId}
            onChanged={() => {
              reload();
            }}
          />
        ) : null}
      </Modal>
    </CrudSection>
  );
}

function OrderDetailPanel({ orderId, onChanged }: { orderId: number; onChanged: () => void }) {
  const { data: order, loading, error, reload } = usePanelRequest(() => cmsGetOrder(orderId), [orderId]);
  const { data: events } = usePanelRequest(() => cmsGetOrderEvents(orderId), [orderId, order?.status]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAction(action: OrderFulfillmentAction, needsReason?: boolean) {
    let reason: string | undefined;
    if (needsReason) {
      reason = window.prompt("دلیل (اختیاری):") ?? undefined;
    }
    setBusy(true);
    setActionError(null);
    try {
      await cmsRunOrderAction(orderId, action, reason);
      reload();
      onChanged();
    } catch (reason_) {
      setActionError(getApiErrorMessage(reason_));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !order) {
    return <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>;
  }
  if (error || !order) {
    return <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error ?? "سفارش پیدا نشد."}</p>;
  }

  const availableActions = ACTIONS_BY_STATUS[order.status] ?? [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p dir="ltr" className="text-left font-mono text-sm">{order.order_number}</p>
          <p className="text-xs font-bold text-slate-500">{order.user_display}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {actionError ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p>
      ) : null}

      {availableActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {availableActions.map((item) => (
            <button
              key={item.action}
              type="button"
              disabled={busy}
              onClick={() => handleAction(item.action, item.needsReason)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-black text-[#062452]">اقلام سفارش</h3>
        <ul className="grid gap-1.5 text-sm font-bold text-slate-700">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span>{item.title_snapshot} × {item.quantity}</span>
              <span>{formatPrice(item.line_total_amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between text-sm font-black text-[#062452]">
          <span>جمع کل</span>
          <span>{formatPrice(order.total_amount)}</span>
        </div>
      </div>

      {order.requires_shipping && order.shipping_address_line1 ? (
        <div>
          <h3 className="mb-2 text-sm font-black text-[#062452]">آدرس ارسال</h3>
          <p className="text-sm font-bold text-slate-600">
            {order.shipping_recipient_name} — {order.shipping_province}، {order.shipping_city}، {order.shipping_address_line1}
          </p>
        </div>
      ) : null}

      {events && events.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-black text-[#062452]">تاریخچه رویدادها</h3>
          <ul className="grid gap-1.5 text-xs font-bold text-slate-500">
            {events.map((event) => (
              <li key={event.id} className="border-b border-slate-100 pb-1.5">
                {event.message || event.event_type}
                {event.actor ? ` — ${event.actor}` : ""}
                {" — "}
                {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.created_at))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
