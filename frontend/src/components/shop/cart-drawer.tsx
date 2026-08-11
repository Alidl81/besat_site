"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import type { CartItemIssue } from "@/types/shop";

function cartIssueLabel(issue: CartItemIssue): string {
  switch (issue) {
    case "unavailable":
      return "این محصول دیگر در دسترس نیست.";
    case "insufficient_stock":
      return "موجودی کافی نیست.";
    case "max_quantity_exceeded":
      return "تعداد بیشتر از حد مجاز خرید است.";
    case "course_full":
      return "ظرفیت این دوره تکمیل شده است.";
    case "invalid_quantity":
      return "تعداد این آیتم نامعتبر است.";
    default:
      return "";
  }
}

export function CartWidget() {
  const { cart, loading, updateItem, removeItem } = useShopCart();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(drawerRef, open, () => setOpen(false), triggerRef);

  const itemCount = cart?.item_count ?? 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`سبد خرید${itemCount > 0 ? `، ${itemCount} کالا` : ""}`}
        className="relative inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-black text-[#0a2848] transition hover:bg-[#f4f1ea] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30"
      >
        <ShoppingBag aria-hidden="true" className="size-4" />
        سبد خرید
        {itemCount > 0 ? (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-[#c98c3d] px-1.5 py-0.5 text-[11px] font-black text-white">
            {new Intl.NumberFormat("fa-IR").format(itemCount)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="بستن سبد خرید"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#04101f]/55 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="سبد خرید"
            dir="rtl"
            className="absolute inset-y-0 left-0 flex w-[min(92vw,26rem)] flex-col bg-white shadow-2xl transition-transform duration-300 motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <h2 className="text-base font-black text-[#0a2848]">سبد خرید</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن"
                className="flex size-9 items-center justify-center rounded-full bg-[#f4f1ea] text-[#0a2848] transition hover:bg-[#e9e4d8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && !cart ? (
                <p className="py-10 text-center text-sm font-bold text-[#0a2848]/50">در حال بارگذاری…</p>
              ) : !cart || cart.items.length === 0 ? (
                <p className="py-10 text-center text-sm font-bold text-[#0a2848]/50">سبد خرید شما خالی است.</p>
              ) : (
                <ul className="grid gap-4">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex gap-3 border-b border-[#f0ede5] pb-4 last:border-b-0">
                      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#f4f1ea]">
                        {item.product.featured_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.product.featured_image} alt="" className="size-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/shop/${item.product.slug}`}
                          onClick={() => setOpen(false)}
                          className="line-clamp-2 text-sm font-black text-[#0a2848] hover:underline"
                        >
                          {item.product.title}
                        </Link>
                        {item.variant_title ? (
                          <p className="mt-0.5 text-xs font-bold text-[#0a2848]/50">{item.variant_title}</p>
                        ) : null}
                        {item.issue ? (
                          <p className="mt-1 text-xs font-black text-rose-600">{cartIssueLabel(item.issue)}</p>
                        ) : null}

                        <div className="mt-2 flex items-center justify-between">
                          {item.product.product_type === "physical" ? (
                            <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb]">
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, item.quantity - 1).catch(() => undefined)}
                                disabled={item.quantity <= 1}
                                aria-label={`کاهش تعداد ${item.product.title}`}
                                className="flex size-7 items-center justify-center text-[#0a2848] disabled:opacity-30"
                              >
                                <Minus aria-hidden="true" className="size-3.5" />
                              </button>
                              <span className="min-w-6 text-center text-sm font-black text-[#0a2848]">
                                {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, item.quantity + 1).catch(() => undefined)}
                                aria-label={`افزایش تعداد ${item.product.title}`}
                                className="flex size-7 items-center justify-center text-[#0a2848]"
                              >
                                <Plus aria-hidden="true" className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-[#0a2848]/50">۱ عدد</span>
                          )}
                          <span className="text-sm font-black text-[#0a2848]">
                            {formatPrice(item.line_total_amount)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id).catch(() => undefined)}
                        aria-label={`حذف ${item.product.title} از سبد خرید`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#0a2848]/40 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart && cart.items.length > 0 ? (
              <div className="border-t border-[#e5e7eb] px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-sm font-black text-[#0a2848]">
                  <span>جمع جزء</span>
                  <span>{formatPrice(cart.subtotal_amount)}</span>
                </div>
                <Link
                  href="/shop/checkout"
                  onClick={() => setOpen(false)}
                  aria-disabled={cart.has_blocking_issue}
                  className={`besat-accent-button flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-black ${
                    cart.has_blocking_issue ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  ادامه فرایند خرید
                </Link>
                {cart.has_blocking_issue ? (
                  <p className="mt-2 text-center text-xs font-bold text-rose-600">
                    برای ادامه، آیتم‌های دارای مشکل را از سبد خرید حذف کنید.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
