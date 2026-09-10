"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import { getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
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
  const { cart, loading, error, updateItem, removeItem, refresh } = useShopCart();
  // FE-CART-ERROR-SURFACE-001: a failed mutation used to be silently
  // swallowed (`.catch(() => undefined)`), so a rejected quantity/removal
  // request looked like an unresponsive control with no way to recover.
  const [mutationError, setMutationError] = useState<string | null>(null);
  // FE-SHOP-CART-CONTROLS-DOUBLE-SUBMIT-001: `runMutation(removeItem(item.id))`/
  // `runMutation(updateItem(item.id, item.quantity +/- 1))` used to invoke
  // the mutation before runMutation ever ran, so there was nothing left to
  // guard by the time it could check anything -- two same-tick clicks on a
  // quantity button both computed `item.quantity + 1` against the SAME
  // stale `item.quantity` (since the cart hasn't re-rendered with the new
  // value yet), sending the identical target quantity twice instead of
  // incrementing twice. Taking a thunk instead of an already-started
  // promise lets this check happen before the request is ever dispatched;
  // tracking pending item ids (not a single boolean) lets mutations on
  // DIFFERENT cart items still run concurrently -- only a second mutation
  // for the SAME item while one is already in flight is blocked.
  const pendingItemIdsRef = useRef<Set<number>>(new Set());

  function runMutation(itemId: number, action: () => Promise<void>) {
    if (pendingItemIdsRef.current.has(itemId)) return;
    pendingItemIdsRef.current.add(itemId);
    setMutationError(null);
    action()
      .catch((reason) => setMutationError(getApiErrorMessage(reason)))
      .finally(() => {
        pendingItemIdsRef.current.delete(itemId);
      });
  }

  if (loading && !cart) {
    return <p className="py-16 text-center text-sm font-bold text-[#0a2848]/70">در حال بارگذاری سبد خرید…</p>;
  }

  // A failed initial refresh (network/5xx/429) also leaves `cart` null --
  // that must not be presented as "your cart is empty," which reads as a
  // final, correct state a user has no reason to question or retry.
  if (!cart && error) {
    return (
      <div className="py-16 text-center">
        <TriangleAlert aria-hidden="true" className="mx-auto size-10 text-rose-600" />
        <h1 className="mt-3 text-xl font-black text-[#0a2848]">سبد خرید بارگذاری نشد</h1>
        <p role="alert" className="mt-2 text-sm font-bold text-rose-700">
          {error}
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          className="besat-accent-button mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-black"
        >
          تلاش دوباره
        </button>
      </div>
    );
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
        {mutationError ? (
          <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {mutationError}
          </p>
        ) : null}
        <ul className="grid gap-4">
          {cart.items.map((item) => {
            const image = safePublicMediaUrl(item.product.featured_image);
            return (
            <li
              key={item.id}
              className="flex gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#f4f1ea]">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/shop/${item.product.slug}`} className="text-sm font-black text-[#0a2848] hover:underline">
                    {item.product.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => runMutation(item.id, () => removeItem(item.id))}
                    aria-label={`حذف ${item.product.title} از سبد خرید`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#0a2848]/40 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {item.variant_title ? (
                  <p className="mt-0.5 text-xs font-bold text-[#0a2848]/70">{item.variant_title}</p>
                ) : null}
                {item.issue ? (
                  <p className="mt-1 text-xs font-black text-rose-600">{cartIssueLabel(item.issue)}</p>
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  {item.product.product_type === "physical" ? (
                    <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb]">
                      <button
                        type="button"
                        onClick={() => runMutation(item.id, () => updateItem(item.id, item.quantity - 1))}
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
                        onClick={() => runMutation(item.id, () => updateItem(item.id, item.quantity + 1))}
                        aria-label={`افزایش تعداد ${item.product.title}`}
                        className="flex size-8 items-center justify-center text-[#0a2848]"
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[#0a2848]/70">۱ عدد</span>
                  )}
                  <span className="text-sm font-black text-[#0a2848]">{formatPrice(item.line_total_amount)}</span>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="mb-4 text-base font-black text-[#0a2848]">خلاصه سبد خرید</h2>
        <div className="flex items-center justify-between text-sm font-black text-[#0a2848]">
          <span>جمع جزء</span>
          <span>{formatPrice(cart.subtotal_amount)}</span>
        </div>
        <p className="mt-2 text-xs font-bold text-[#0a2848]/70">هزینه ارسال و مبلغ نهایی در مرحله تسویه حساب محاسبه می‌شود.</p>

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
