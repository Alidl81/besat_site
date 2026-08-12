"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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

export function CartPageView() {
  const { cart, loading, updateItem, removeItem } = useShopCart();

  if (loading && !cart) {
    return <p className="py-16 text-center text-sm font-bold text-[#0a2848]/50">در حال بارگذاری سبد خرید…</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingBag aria-hidden="true" className="mx-auto size-10 text-[#0a2848]/25" />
        <h1 className="mt-3 text-xl font-black text-[#0a2848]">سبد خرید شما خالی است</h1>
        <Link href="/shop" className="besat-accent-button mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-black">
          مشاهده محصولات فروشگاه
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h1 className="mb-5 text-xl font-black text-[#0a2848]">سبد خرید</h1>
        <ul className="grid gap-4">
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#f4f1ea]">
                {item.product.featured_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.featured_image} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/shop/${item.product.slug}`} className="text-sm font-black text-[#0a2848] hover:underline">
                    {item.product.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id).catch(() => undefined)}
                    aria-label={`حذف ${item.product.title} از سبد خرید`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#0a2848]/40 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {item.variant_title ? (
                  <p className="mt-0.5 text-xs font-bold text-[#0a2848]/50">{item.variant_title}</p>
                ) : null}
                {item.issue ? (
                  <p className="mt-1 text-xs font-black text-rose-600">{cartIssueLabel(item.issue)}</p>
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  {item.product.product_type === "physical" ? (
                    <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb]">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, item.quantity - 1).catch(() => undefined)}
                        disabled={item.quantity <= 1}
                        aria-label={`کاهش تعداد ${item.product.title}`}
                        className="flex size-8 items-center justify-center text-[#0a2848] disabled:opacity-30"
                      >
                        <Minus aria-hidden="true" className="size-3.5" />
                      </button>
                      <span className="min-w-7 text-center text-sm font-black text-[#0a2848]">
                        {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, item.quantity + 1).catch(() => undefined)}
                        aria-label={`افزایش تعداد ${item.product.title}`}
                        className="flex size-8 items-center justify-center text-[#0a2848]"
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[#0a2848]/50">۱ عدد</span>
                  )}
                  <span className="text-sm font-black text-[#0a2848]">{formatPrice(item.line_total_amount)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="mb-4 text-base font-black text-[#0a2848]">خلاصه سبد خرید</h2>
        <div className="flex items-center justify-between text-sm font-black text-[#0a2848]">
          <span>جمع جزء</span>
          <span>{formatPrice(cart.subtotal_amount)}</span>
        </div>
        <p className="mt-2 text-xs font-bold text-[#0a2848]/50">هزینه ارسال و مبلغ نهایی در مرحله تسویه حساب محاسبه می‌شود.</p>

        <Link
          href="/shop/checkout"
          aria-disabled={cart.has_blocking_issue}
          className={`besat-accent-button mt-5 flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-black ${
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
      </aside>
    </div>
  );
}
