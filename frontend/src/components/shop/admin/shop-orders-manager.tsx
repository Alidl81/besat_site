"use client";

import { useRef, useState } from "react";
import { ConfirmDialog, CrudSection, EmptyState, Modal, Select, StatusBadge, TextArea } from "@/components/crud/crud-ui";
import { PanelError } from "@/components/dashboard/panel-request-state";
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
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-44"
          aria-label="فیلتر بر اساس وضعیت سفارش"
        >
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
        // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: see shop-categories-manager.tsx
        // -- identical no-retry defect, same shared PanelError fix.
        <PanelError message={error} onRetry={reload} />
      ) : orders.length === 0 ? (
        <EmptyState text="سفارشی ثبت نشده است." />
      ) : (
        <div className="panel-table-scroll">
          {/* panel-table-scroll (globals.css) does two things: `contain:
              paint` isolates this wrapper's overflowing RTL table content
              from inflating documentElement.scrollWidth (root-level
              horizontal overflow that persisted independently of the
              mobile menu drawer this was initially, incorrectly,
              attributed to across several rounds of
              FE-DASH-MOBILE-CLOSED-OVERFLOW-001 -- see
              FE-DASH-RTL-TABLE-ROOT-OVERFLOW-001), and an edge-fade
              background signals when the status/action columns start
              outside the visible area (FE-DASH-RTL-TABLE-MOBILE-AFFORDANCE-001). */}
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>شماره سفارش</th>
                <th>مشتری</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                {/* FE-DASH-RTL-SHOP-ORDER-ACTION-001: same sticky-column fix
                    as shop-products-manager.tsx -- the panel-table-scroll
                    edge-cue fade signals the table is scrollable, but at
                    390px this table's sole row action still sat entirely
                    outside the visible RTL wrapper, unreachable without
                    already knowing to scroll. */}
                <th className="panel-table-action-sticky"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td dir="ltr" className="text-left font-mono text-xs">{order.order_number}</td>
                  <td className="font-black">{order.user_display}</td>
                  <td>{formatPrice(order.total_amount)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="panel-table-action-sticky">
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
  // FE-SHOP-ORDER-ACTION-DOUBLE-SUBMIT-001: `busy` is state-backed, so two
  // same-tick clicks both read it as `false` before either update commits
  // -- a synchronous ref guard closes that race.
  const busyRef = useRef(false);
  // FE-DASH-SHOP-ORDER-DESTRUCTIVE-CONFIRM-001: this used to go straight
  // from the action button to window.prompt("دلیل (اختیاری):"), then run
  // the action REGARDLESS of how that prompt was dismissed -- prompt()
  // returning null (Cancel/Escape/backdrop) was only ever used to null out
  // the optional reason text, never checked as "abort the action". Both
  // "cancel" and "refund" are irreversible order-state transitions, so
  // dismissing the prompt silently cancelled/refunded the order anyway.
  // A real ConfirmDialog (native window.prompt isn't stylable RTL, isn't a
  // proper aria dialog, and conflates "provide detail" with "confirm the
  // destructive action") makes Escape/backdrop/Cancel genuinely abort --
  // its own onCancel only ever closes this dialog, never calls runAction.
  const [pendingAction, setPendingAction] = useState<{ action: OrderFulfillmentAction; label: string; needsReason?: boolean } | null>(null);
  const [pendingReason, setPendingReason] = useState("");

  function requestAction(item: { action: OrderFulfillmentAction; label: string; needsReason?: boolean }) {
    if (busyRef.current) return;
    if (!item.needsReason) {
      void runAction(item.action, undefined);
      return;
    }
    setPendingAction(item);
    setPendingReason("");
  }

  function cancelPendingAction() {
    setPendingAction(null);
    setPendingReason("");
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const reason = pendingReason.trim() || undefined;
    setPendingAction(null);
    setPendingReason("");
    void runAction(pendingAction.action, reason);
  }

  async function runAction(action: OrderFulfillmentAction, reason: string | undefined) {
    if (busyRef.current) return;
    busyRef.current = true;
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
      busyRef.current = false;
    }
  }

  if (loading && !order) {
    return <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>;
  }
  if (error) {
    // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: a genuine fetch failure is
    // retryable (unlike a real "not found", which never was); split out so
    // only this branch gets the shared PanelError retry action.
    return <PanelError message={error} onRetry={reload} />;
  }
  if (!order) {
    return <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">سفارش پیدا نشد.</p>;
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
              onClick={() => requestAction(item)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.label ?? ""}
        description="این عملیات قابل بازگشت نیست. در صورت تمایل می‌توانید دلیل را بنویسید."
        confirmLabel={pendingAction?.label ?? "تایید"}
        onConfirm={confirmPendingAction}
        onCancel={cancelPendingAction}
      >
        <TextArea
          value={pendingReason}
          onChange={(event) => setPendingReason(event.target.value)}
          placeholder="دلیل (اختیاری)"
          rows={3}
        />
      </ConfirmDialog>

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
