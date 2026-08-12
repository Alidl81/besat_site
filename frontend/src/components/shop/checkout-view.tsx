"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { Container } from "@/components/shared/container";
import { AddressForm } from "@/components/shop/address-form";
import { getApiErrorMessage } from "@/lib/api/client";
import { readBesatSession } from "@/lib/auth/auth-session";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import { createAddress, getMyAddresses, placeOrder, startPayment } from "@/services/shop-account-service";
import { getCheckoutPreview, getShippingMethods } from "@/services/shop-service";
import type { Address, CheckoutPreview, ShippingMethod } from "@/types/shop";

export function CheckoutView() {
  const { cart, loading: cartLoading, refresh: refreshCart } = useShopCart();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [customerNote, setCustomerNote] = useState("");

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsAuthenticated(Boolean(readBesatSession()));
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.resolve().then(() => {
      getShippingMethods()
        .then((methods) => {
          setShippingMethods(methods);
          const defaultMethod = methods.find((method) => method.is_default) ?? methods[0];
          if (defaultMethod) setSelectedShippingMethodId(defaultMethod.id);
        })
        .catch(() => setShippingMethods([]));
      getMyAddresses()
        .then((list) => {
          setAddresses(list);
          const defaultAddress = list.find((address) => address.is_default) ?? list[0];
          if (defaultAddress) setSelectedAddressId(defaultAddress.id);
          else setShowAddressForm(list.length === 0);
        })
        .catch(() => setAddresses([]));
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.resolve().then(() => {
      setPreviewLoading(true);
      return getCheckoutPreview(selectedShippingMethodId)
        .then((data) => {
          if (active) setPreview(data);
        })
        .catch(() => {
          if (active) setError("محاسبه جمع سبد خرید ممکن نشد.");
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, selectedShippingMethodId, cart?.items.length]);

  async function handleCreateAddress(values: Parameters<typeof createAddress>[0]) {
    const created = await createAddress(values);
    setAddresses((current) => [created, ...current]);
    setSelectedAddressId(created.id);
    setShowAddressForm(false);
  }

  async function handlePlaceOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder({
        shipping_method_id: preview?.requires_shipping ? selectedShippingMethodId : null,
        address_id: preview?.requires_shipping ? selectedAddressId : null,
        customer_note: customerNote || null,
      });
      await refreshCart();
      const intent = await startPayment(order.order_number);
      window.location.href = intent.redirect_url;
    } catch (reason) {
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
        <p className="mt-3 text-sm font-bold text-[#0a2848]/60">
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

  if (!cart || cart.items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-xl font-black text-[#0a2848]">سبد خرید شما خالی است</h1>
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

            {addresses.length > 0 && !showAddressForm ? (
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
                      <span dir="ltr" className="mt-1 block text-right text-xs font-bold text-[#0a2848]/50">
                        {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-black text-[#c98c3d] hover:underline"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  افزودن آدرس جدید
                </button>
              </div>
            ) : (
              <AddressForm
                onSubmit={handleCreateAddress}
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
              />
            )}
          </section>
        ) : null}

        {preview?.requires_shipping && shippingMethods.length > 0 ? (
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
        ) : null}

        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-3 text-base font-black text-[#0a2848]">یادداشت سفارش (اختیاری)</h2>
          <textarea
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

        {previewLoading || !preview ? (
          <div className="py-4 text-center text-sm font-bold text-[#0a2848]/40">در حال محاسبه…</div>
        ) : (
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
        )}

        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-rose-600">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={
            submitting ||
            previewLoading ||
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
