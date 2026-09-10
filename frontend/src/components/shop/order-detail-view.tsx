"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, PackageX, TriangleAlert } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatPrice } from "@/lib/shop/money";
import { getMyOrder, startPayment } from "@/services/shop-account-service";
import type { OrderDetail, OrderStatus } from "@/types/shop";

// FE-A11Y-CONTRAST-SHOP-COURSE-001 (same defect pattern, proactively
// applied here too): text-amber-600 on white is 3.19:1, below WCAG AA's
// 4.5:1. text-amber-800 (7.09:1) is the already-correct shade this
// codebase uses elsewhere for the same amber-status role.
const STATUS_PRESENTATION: Record<OrderStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "پیش‌نویس", tone: "text-slate-500", icon: Clock },
  pending_payment: { label: "در انتظار پرداخت", tone: "text-amber-800", icon: Clock },
  payment_processing: { label: "در حال پردازش پرداخت", tone: "text-amber-800", icon: Clock },
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
  // FE-SHOP-PAYMENT-RETRY-DOUBLE-SUBMIT-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={retrying}`
  // only takes effect after React re-renders, so two clicks dispatched
  // before that render both start handleRetryPayment. A synchronously
  // read/written ref blocks the re-entrant call immediately.
  const retryingRef = useRef(false);
  // FE-SHOP-ORDER-DETAIL-STALE-NAV-001: load() had no abort/sequence/
  // current-order fence at all -- if the App Router reuses this same
  // component instance across an A -> B order-number navigation (or the
  // 3s payment-processing poll below simply resolves out of order),
  // whichever request happens to resolve *last* wins, even if it's for
  // an order the user has since navigated away from. latestOrderNumberRef
  // always holds the most recently *requested* order number (set
  // synchronously in the effect that issues each request, before its
  // await); a response is only applied if the order number it was
  // requested for still matches that value when it resolves.
  const latestOrderNumberRef = useRef(orderNumber);

  // FE-SHOP-ORDER-DETAIL-STALE-NAV-001 (REOPENED, adjacent case): the
  // sequence fence above already stops a stale response from *overwriting*
  // the current order, but it never CLEARS the previous order's data when
  // a new order-number navigation starts -- `order` just keeps holding
  // order A's data until a *successful* response for B eventually arrives.
  // If B's request fails instead, `error` gets set correctly, but the
  // error panel below is gated on `!order`, so A's stale content kept
  // rendering under B's route instead of the retryable error state.
  // Clearing `order`/`error` and re-arming `loading` here, during render,
  // whenever `orderNumber` itself changes -- the same render-phase state-
  // adjustment pattern used for FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001 and
  // FE-AUTH-SET-PASSWORD-TOKEN-RERENDER-001 earlier this session -- means
  // the component always starts a new order's lifecycle from a clean
  // loading state, never carrying the previous order's content or error
  // into it.
  const [prevOrderNumber, setPrevOrderNumber] = useState(orderNumber);
  if (orderNumber !== prevOrderNumber) {
    setPrevOrderNumber(orderNumber);
    setOrder(null);
    setError(null);
    setLoading(true);
  }

  function load(forOrderNumber: string) {
    setLoading(true);
    setError(null);
    getMyOrder(forOrderNumber)
      .then((result) => {
        if (latestOrderNumberRef.current !== forOrderNumber) return;
        setOrder(result);
      })
      .catch((reason) => {
        if (latestOrderNumberRef.current !== forOrderNumber) return;
        setError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (latestOrderNumberRef.current !== forOrderNumber) return;
        setLoading(false);
      });
  }

  useEffect(() => {
    latestOrderNumberRef.current = orderNumber;
    Promise.resolve().then(() => load(orderNumber));
  }, [orderNumber]);

  // Poll briefly while payment is processing -- the order only ever
  // shows a state the backend has actually persisted, never a status
  // inferred from having landed on this page.
  useEffect(() => {
    if (order?.status !== "payment_processing") return;
    const timer = window.setTimeout(() => load(orderNumber), 3000);
    return () => window.clearTimeout(timer);
  }, [order?.status, orderNumber]);

  async function handleRetryPayment() {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    setError(null);
    try {
      const intent = await startPayment(orderNumber);
      window.location.href = intent.redirect_url;
    } catch (reason) {
      retryingRef.current = false;
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

  // FE-SHOP-ORDER-ERROR-001: a bare paragraph with no heading, no live
  // region, and no way forward left a failed order lookup (a 404, a
  // transient 429/500, or a network error) as a dead end that assistive
  // tech had no way to announce and a sighted user had no way to recover
  // from short of the browser's own back button.
  if (error && !order) {
    return (
      <div className="py-16 text-center">
        <TriangleAlert aria-hidden="true" className="mx-auto size-10 text-rose-600" />
        <h1 className="mt-3 text-lg font-black text-rose-900">مشکلی در نمایش این سفارش پیش آمد</h1>
        <p role="alert" className="mt-2 text-sm font-bold text-rose-700">
          {error}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => load(orderNumber)}
            className="besat-accent-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black"
          >
            تلاش دوباره
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] px-5 py-2.5 text-sm font-black text-[#0a2848] transition hover:bg-[#f4f1ea]"
          >
            بازگشت به فروشگاه
          </Link>
        </div>
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
            <p className="text-xs font-bold text-[#0a2848]/70">شماره سفارش</p>
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
          <p role="status" className="mt-3 text-xs font-bold text-amber-800">
            در حال بررسی نتیجه پرداخت شما هستیم؛ این صفحه به‌صورت خودکار به‌روزرسانی می‌شود.
          </p>
        ) : null}

        {/* FE-SHOP-ORDER-PENDING-PAYMENT-RETRY-001: this used to only
            check "payment_failed", but PaymentStartAPIView/start_payment
            already accept PENDING_PAYMENT too (that's the normal state
            right after an order is placed, before any attempt exists) --
            a payment-start call failing before ever reaching the provider
            (start_payment's own transaction rolls back the attempt row
            with it) leaves an order at PENDING_PAYMENT with
            latest_payment_attempt=null forever, and this page showed zero
            retry buttons for it despite the backend being ready to accept
            one immediately. */}
        {order.status === "payment_failed" || order.status === "pending_payment" ? (
          <div className="mt-4">
            <p className={`text-sm font-bold ${order.status === "payment_failed" ? "text-rose-600" : "text-amber-800"}`}>
              {order.status === "payment_failed"
                ? "پرداخت این سفارش ناموفق بود."
                : "پرداخت این سفارش هنوز انجام نشده است."}
            </p>
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={retrying}
              className="besat-accent-button mt-3 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black disabled:opacity-60"
            >
              {retrying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              تلاش دوباره برای پرداخت
            </button>
            {/* FE-SHOP-ORDER-PAYMENT-RETRY-ERROR-001: handleRetryPayment()
                sets `error` on a failed retry, but this component's only
                error-rendering branch is `error && !order` (the initial
                load-failure page) -- once `order` has loaded (always true
                here, since this section only renders inside a loaded
                order), a failed retry silently reset the button with no
                visible or announced feedback at all. */}
            {error ? (
              <p role="alert" className="mt-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {order.status === "completed" || order.status === "paid" ? (
          order.items.some((item) => item.product_type_snapshot !== "physical") ? (
            // FE-A11Y-CONTRAST-HOME-NEWS-001 (same defect pattern, proactively
            // applied here too): same failing color/white-card-background pairing.
            <Link href="/dashboard/parents/shop/courses" className="mt-3 inline-block text-sm font-black text-[#8a641f] hover:underline">
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
