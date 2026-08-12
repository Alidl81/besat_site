"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, PackageX, TriangleAlert } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatPrice } from "@/lib/shop/money";
import { getMyOrder, startPayment } from "@/services/shop-account-service";
import type { OrderDetail, OrderStatus } from "@/types/shop";

const STATUS_PRESENTATION: Record<OrderStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "پیش‌نویس", tone: "text-slate-500", icon: Clock },
  pending_payment: { label: "در انتظار پرداخت", tone: "text-amber-600", icon: Clock },
  payment_processing: { label: "در حال پردازش پرداخت", tone: "text-amber-600", icon: Clock },
  paid: { label: "پرداخت‌شده", tone: "text-emerald-600", icon: CheckCircle2 },
  processing: { label: "در حال پردازش", tone: "text-emerald-600", icon: Clock },
  shipped: { label: "ارسال‌شده", tone: "text-emerald-600", icon: CheckCircle2 },
  completed: { label: "تکمیل‌شده", tone: "text-emerald-600", icon: CheckCircle2 },
  cancelled: { label: "لغوشده", tone: "text-slate-500", icon: PackageX },
  payment_failed: { label: "پرداخت ناموفق", tone: "text-rose-600", icon: TriangleAlert },
  refunded: { label: "بازگشت وجه", tone: "text-slate-500", icon: PackageX },
  partially_refunded: { label: "بازگشت جزئی وجه", tone: "text-slate-500", icon: PackageX },
};

export function OrderDetailView({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    getMyOrder(orderNumber)
      .then(setOrder)
      .catch((reason) => setError(getApiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  // Poll briefly while payment is processing -- the order only ever
  // shows a state the backend has actually persisted, never a status
  // inferred from having landed on this page.
  useEffect(() => {
    if (order?.status !== "payment_processing") return;
    const timer = window.setTimeout(load, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  async function handleRetryPayment() {
    setRetrying(true);
    try {
      const intent = await startPayment(orderNumber);
      window.location.href = intent.redirect_url;
    } catch (reason) {
      setError(getApiErrorMessage(reason));
      setRetrying(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-hidden="true" className="size-6 animate-spin text-[#0a2848]/40" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-bold text-rose-600">{error}</p>
      </div>
    );
  }

  if (!order) return null;

  const presentation = STATUS_PRESENTATION[order.status];
  const StatusIcon = presentation.icon;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#0a2848]/50">شماره سفارش</p>
            <p dir="ltr" className="text-left text-base font-black text-[#0a2848]">
              {order.order_number}
            </p>
          </div>
          <div className={`flex items-center gap-2 text-sm font-black ${presentation.tone}`}>
            <StatusIcon aria-hidden="true" className="size-5" />
            {presentation.label}
          </div>
        </div>

        {order.status === "payment_processing" ? (
          <p role="status" className="mt-3 text-xs font-bold text-amber-600">
            در حال بررسی نتیجه پرداخت شما هستیم؛ این صفحه به‌صورت خودکار به‌روزرسانی می‌شود.
          </p>
        ) : null}

        {order.status === "payment_failed" ? (
          <div className="mt-4">
            <p className="text-sm font-bold text-rose-600">پرداخت این سفارش ناموفق بود.</p>
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={retrying}
              className="besat-accent-button mt-3 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black disabled:opacity-60"
            >
              {retrying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              تلاش دوباره برای پرداخت
            </button>
          </div>
        ) : null}

        {order.status === "completed" || order.status === "paid" ? (
          order.items.some((item) => item.product_type_snapshot !== "physical") ? (
            <Link href="/dashboard/parents/shop/courses" className="mt-3 inline-block text-sm font-black text-[#c98c3d] hover:underline">
              مشاهده دوره‌های خریداری‌شده ←
            </Link>
          ) : null
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="mb-4 text-base font-black text-[#0a2848]">اقلام سفارش</h2>
        <ul className="grid gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[#f0ede5] pb-3 text-sm font-bold text-[#0a2848] last:border-b-0">
              <span>
                {item.title_snapshot} × {new Intl.NumberFormat("fa-IR").format(item.quantity)}
              </span>
              <span>{formatPrice(item.line_total_amount)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-1.5 border-t border-[#f0ede5] pt-4 text-sm font-bold text-[#0a2848]">
          <div className="flex items-center justify-between">
            <span>جمع جزء</span>
            <span>{formatPrice(order.subtotal_amount)}</span>
          </div>
          {order.requires_shipping ? (
            <div className="flex items-center justify-between">
              <span>هزینه ارسال</span>
              <span>{formatPrice(order.shipping_amount)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between text-base font-black">
            <span>جمع کل</span>
            <span>{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {order.requires_shipping && order.shipping_address_line1 ? (
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-2 text-base font-black text-[#0a2848]">آدرس ارسال</h2>
          <p className="text-sm font-bold leading-7 text-[#0a2848]/75">
            {order.shipping_recipient_name} — {order.shipping_province}، {order.shipping_city}،{" "}
            {order.shipping_address_line1}
          </p>
        </div>
      ) : null}
    </div>
  );
}
