"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { Container } from "@/components/shared/container";
import { AddressForm } from "@/components/shop/address-form";
import { getApiErrorMessage } from "@/lib/api/client";
import { readBesatSession } from "@/lib/auth/auth-session";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import { createAddress, getMyAddresses, placeOrder, startPayment } from "@/services/shop-account-service";
import { getCheckoutPreview, getShippingMethods } from "@/services/shop-service";
import type { Address, CheckoutPreview, OrderDetail, ShippingMethod } from "@/types/shop";

export function CheckoutView() {
  const { cart, loading: cartLoading, refresh: refreshCart } = useShopCart();
  const orderNoteHeadingId = useId();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [shippingMethodsLoading, setShippingMethodsLoading] = useState(true);
  const [shippingMethodsError, setShippingMethodsError] = useState<string | null>(null);
  const [shippingMethodsRetryToken, setShippingMethodsRetryToken] = useState(0);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [addressesRetryToken, setAddressesRetryToken] = useState(0);

  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [customerNote, setCustomerNote] = useState("");

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRetryToken, setPreviewRetryToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001: once placeOrder() has
  // succeeded, the order genuinely exists server-side even if payment
  // initiation then fails -- silently reusing the order for an internal
  // retry (pendingOrderRef, below) isn't enough on its own: the user has
  // no way to know an order was created if they navigate away before
  // retrying, or to reach it again later. Surfacing the order number and
  // a link to its own detail page (which has its own "تلاش دوباره برای
  // پرداخت" retry action) gives them a durable recovery path.
  const [recoverableOrderNumber, setRecoverableOrderNumber] = useState<string | null>(null);
  // FE-SHOP-CHECKOUT-DOUBLE-SUBMIT-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={submitting}`
  // only takes effect after React re-renders, so two clicks dispatched
  // before that render both start handlePlaceOrder. A synchronously read/
  // written ref blocks the re-entrant call immediately.
  const submittingRef = useRef(false);
  // FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001: placeOrder() is a durable
  // server-side mutation (the order and its stock reservation already
  // exist once it resolves) -- if startPayment() then fails, retrying the
  // whole flow used to call placeOrder() again, risking a second order/
  // reservation for the same cart. Once an order has been created,
  // pendingOrderRef remembers it so a retry goes straight to a fresh
  // startPayment() attempt for that same order instead of creating
  // another one. It's a ref, not state, because it must be visible to the
  // very next handlePlaceOrder() call synchronously -- there's no render
  // in between a failed attempt and the user clicking "retry".
  const pendingOrderRef = useRef<OrderDetail | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsAuthenticated(Boolean(readBesatSession()));
      setAuthChecked(true);
    });
  }, []);

  // FE-CHECKOUT-DEPENDENCY-ERROR-001: shipping-method/address/preview
  // fetch failures used to be caught into an empty array or a single
  // generic message with no error state and no retry -- a transient
  // 429/5xx/network failure was indistinguishable from "this store
  // genuinely has no shipping methods configured" or left the payment
  // button permanently disabled with no way to recover short of a full
  // reload. Each dependency now tracks its own error/retry state
  // separately, matching the same pattern already used for the shop
  // cart's refresh/mutation errors (FE-CART-ERROR-SURFACE-001).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.resolve().then(() => {
      setShippingMethodsLoading(true);
      setShippingMethodsError(null);
      return getShippingMethods()
        .then((methods) => {
          if (!active) return;
          setShippingMethods(methods);
          const defaultMethod = methods.find((method) => method.is_default) ?? methods[0];
          if (defaultMethod) setSelectedShippingMethodId(defaultMethod.id);
        })
        .catch((reason) => {
          if (active) setShippingMethodsError(getApiErrorMessage(reason));
        })
        .finally(() => {
          if (active) setShippingMethodsLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, shippingMethodsRetryToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.resolve().then(() => {
      setAddressesLoading(true);
      setAddressesError(null);
      return getMyAddresses()
        .then((list) => {
          if (!active) return;
          setAddresses(list);
          const defaultAddress = list.find((address) => address.is_default) ?? list[0];
          if (defaultAddress) setSelectedAddressId(defaultAddress.id);
          else setShowAddressForm(list.length === 0);
        })
        .catch((reason) => {
          if (active) setAddressesError(getApiErrorMessage(reason));
        })
        .finally(() => {
          if (active) setAddressesLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, addressesRetryToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.resolve().then(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      return getCheckoutPreview(selectedShippingMethodId)
        .then((data) => {
          if (active) setPreview(data);
        })
        .catch((reason) => {
          if (active) setPreviewError(getApiErrorMessage(reason));
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, selectedShippingMethodId, cart?.items.length, previewRetryToken]);

  async function handleCreateAddress(values: Parameters<typeof createAddress>[0]) {
    const created = await createAddress(values);
    setAddresses((current) => [created, ...current]);
    setSelectedAddressId(created.id);
    setShowAddressForm(false);
  }

  async function handlePlaceOrder() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const order = pendingOrderRef.current ?? await placeOrder({
        shipping_method_id: preview?.requires_shipping ? selectedShippingMethodId : null,
        address_id: preview?.requires_shipping ? selectedAddressId : null,
        customer_note: customerNote || null,
      });
      pendingOrderRef.current = order;
      setRecoverableOrderNumber(order.order_number);
      // FE-SHOP-CHECKOUT-POST-ORDER-REFRESH-GAP-001: placeOrder() already
      // created the order and its stock reservation server-side by this
      // point -- refreshing the local cart display is a courtesy, not a
      // precondition for payment. Letting a refresh failure here abort the
      // flow stranded an already-placed order with no path to payment and
      // only a generic error message, so this is now best-effort and must
      // never block startPayment.
      await refreshCart().catch(() => undefined);
      const intent = await startPayment(order.order_number);
      window.location.href = intent.redirect_url;
    } catch (reason) {
      submittingRef.current = false;
      setError(getApiErrorMessage(reason));
      setSubmitting(false);
    }
  }

  if (!authChecked || cartLoading) {
    return (
      <Container className="py-16 text-center">
        <Loader2 aria-hidden="true" className="mx-auto size-6 animate-spin text-[#0a2848]/40" />
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-xl font-black text-[#0a2848]">برای ادامه خرید وارد حساب کاربری شوید</h1>
        <p className="mt-3 text-sm font-bold text-[#0a2848]/70">
          سفارش‌ها و دوره‌های خریداری‌شده شما به حساب کاربری‌تان متصل می‌شوند.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/shop/register" className="besat-accent-button rounded-xl px-6 py-3 text-sm font-black">
            ساخت حساب کاربری
          </Link>
          <Link
            href="/login?next=/shop/checkout"
            className="rounded-xl border border-[#e5e7eb] px-6 py-3 text-sm font-black text-[#0a2848]"
          >
            ورود به حساب
          </Link>
        </div>
      </Container>
    );
  }

  // FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001: placeOrder() already
  // consumed the cart server-side by the time startPayment() can fail
  // (e.g. a gateway 503) -- refreshCart() right after placing the order
  // (see handlePlaceOrder above) legitimately returns an empty cart even
  // though a real order now exists with no payment ever started. The
  // empty-cart branch below used to return unconditionally, before ever
  // reaching the error/recoverableOrderNumber markup further down this
  // component, so a customer whose payment failed to even start saw only
  // "your cart is empty" with no way to find the order they were already
  // charged a stock reservation for.
  const recoveryNotice = recoverableOrderNumber ? (
    <p role="alert" className="mt-4 text-sm font-bold text-rose-600">
      {error}{" "}
      سفارش شما با شماره «{recoverableOrderNumber}» ثبت شد.{" "}
      <Link href={`/shop/orders/${encodeURIComponent(recoverableOrderNumber)}`} className="underline">
        پیگیری و تلاش دوباره برای پرداخت سفارش {recoverableOrderNumber}
      </Link>
    </p>
  ) : null;

  if (!cart || cart.items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-xl font-black text-[#0a2848]">سبد خرید شما خالی است</h1>
        {recoveryNotice}
        <Link href="/shop" className="besat-accent-button mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-black">
          بازگشت به فروشگاه
        </Link>
      </Container>
    );
  }

  return (
    <Container className="grid gap-8 py-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-6">
        <h1 className="text-xl font-black text-[#0a2848]">تسویه حساب</h1>

        {preview?.requires_shipping ? (
          <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#0a2848]">
              <MapPin aria-hidden="true" className="size-4" />
              آدرس ارسال
            </h2>

            {addressesError ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {addressesError}
                <button
                  type="button"
                  onClick={() => setAddressesRetryToken((token) => token + 1)}
                  className="mt-3 block rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                >
                  تلاش دوباره
                </button>
              </div>
            ) : addresses.length > 0 && !showAddressForm ? (
              <div className="grid gap-2">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm font-bold text-[#0a2848] ${
                      selectedAddressId === address.id ? "border-[#c98c3d] bg-[#fbf3e7]" : "border-[#e5e7eb]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block">
                        {address.recipient_full_name} — {address.province}، {address.city}،{" "}
                        {address.address_line1}
                      </span>
                      <span dir="ltr" className="mt-1 block text-right text-xs font-bold text-[#0a2848]/70">
                        {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  // FE-A11Y-CONTRAST-HOME-NEWS-001 (same defect pattern, proactively
                  // applied here too): #c98c3d text on a white card background is
                  // ~2.87:1, below WCAG AA's 4.5:1 for this 12px text.
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-black text-[#8a641f] hover:underline"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  افزودن آدرس جدید
                </button>
              </div>
            ) : addressesLoading ? (
              <p className="text-sm font-bold text-[#0a2848]/40">در حال بارگذاری آدرس‌ها…</p>
            ) : (
              <AddressForm
                onSubmit={handleCreateAddress}
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
              />
            )}
          </section>
        ) : null}

        {preview?.requires_shipping && shippingMethodsError ? (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
            {shippingMethodsError}
            <button
              type="button"
              onClick={() => setShippingMethodsRetryToken((token) => token + 1)}
              className="mt-3 block rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
            >
              تلاش دوباره
            </button>
          </section>
        ) : preview?.requires_shipping && shippingMethodsLoading ? (
          <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <p className="text-sm font-bold text-[#0a2848]/40">در حال بارگذاری روش‌های ارسال…</p>
          </section>
        ) : preview?.requires_shipping && shippingMethods.length > 0 ? (
          <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <h2 className="mb-4 text-base font-black text-[#0a2848]">روش ارسال</h2>
            <div className="grid gap-2">
              {shippingMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm font-bold text-[#0a2848] ${
                    selectedShippingMethodId === method.id ? "border-[#c98c3d] bg-[#fbf3e7]" : "border-[#e5e7eb]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping-method"
                      checked={selectedShippingMethodId === method.id}
                      onChange={() => setSelectedShippingMethodId(method.id)}
                    />
                    {method.title}
                  </span>
                  <span>{formatPrice(method.price_amount)}</span>
                </label>
              ))}
            </div>
          </section>
        ) : preview?.requires_shipping && shippingMethods.length === 0 ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700"
          >
            هیچ روش ارسالی فعال نیست، بنابراین امکان تکمیل خرید این سفارش وجود ندارد. لطفاً با پشتیبانی فروشگاه تماس بگیرید.
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
          <h2 id={orderNoteHeadingId} className="mb-3 text-base font-black text-[#0a2848]">یادداشت سفارش (اختیاری)</h2>
          <textarea
            aria-labelledby={orderNoteHeadingId}
            value={customerNote}
            onChange={(event) => setCustomerNote(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="mb-4 text-base font-black text-[#0a2848]">خلاصه سفارش</h2>

        <ul className="grid gap-2 border-b border-[#f0ede5] pb-4 text-sm font-bold text-[#0a2848]/80">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <span className="line-clamp-1">
                {item.product.title} × {new Intl.NumberFormat("fa-IR").format(item.quantity)}
              </span>
              <span className="shrink-0">{formatPrice(item.line_total_amount)}</span>
            </li>
          ))}
        </ul>

        {previewError ? (
          <div role="alert" className="py-4 text-sm font-bold text-rose-700">
            {previewError}
            <button
              type="button"
              onClick={() => setPreviewRetryToken((token) => token + 1)}
              className="mt-3 block rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
            >
              تلاش دوباره
            </button>
          </div>
        ) : null}

        {!previewError && previewLoading && !preview ? (
          <div className="py-4 text-center text-sm font-bold text-[#0a2848]/40">در حال محاسبه…</div>
        ) : preview ? (
          <div className="grid gap-2 py-4 text-sm font-bold text-[#0a2848]">
            <div className="flex items-center justify-between">
              <span>جمع جزء</span>
              <span>{formatPrice(preview.subtotal_amount)}</span>
            </div>
            {preview.requires_shipping ? (
              <div className="flex items-center justify-between">
                <span>هزینه ارسال</span>
                <span>{formatPrice(preview.shipping_amount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-[#f0ede5] pt-2 text-base font-black">
              <span>جمع کل</span>
              <span>{formatPrice(preview.total_amount)}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-rose-600">
            {error}
            {recoverableOrderNumber ? (
              <>
                {" "}
                سفارش شما با شماره «{recoverableOrderNumber}» ثبت شد.{" "}
                <Link href={`/shop/orders/${encodeURIComponent(recoverableOrderNumber)}`} className="underline">
                  پیگیری و تلاش دوباره برای پرداخت سفارش {recoverableOrderNumber}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={
            submitting ||
            previewLoading ||
            Boolean(previewError) ||
            !preview?.can_checkout ||
            (preview.requires_shipping && (!selectedAddressId || !selectedShippingMethodId))
          }
          className="besat-accent-button mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          پرداخت و ثبت سفارش
        </button>
        {preview && !preview.can_checkout ? (
          <p className="mt-2 text-center text-xs font-bold text-rose-600">
            برخی آیتم‌های سبد خرید دارای مشکل هستند؛ به سبد خرید بازگردید و آن‌ها را اصلاح کنید.
          </p>
        ) : null}
      </aside>
    </Container>
  );
}
