"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap, Loader2, Minus, Plus, Share2, ShieldCheck, Truck } from "lucide-react";
import { RichContentRenderer } from "@/components/content/rich-content-renderer";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import { getApiErrorMessage } from "@/lib/api/client";
import type { ProductDetail } from "@/types/shop";

function jalaliDate(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const { addItem } = useShopCart();
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const isPhysical = product.product_type === "physical";
  const isCourse = product.product_type === "online_course" || product.product_type === "in_person_course";
  const physical = product.physical_detail;
  const course = product.course_detail;

  const unavailable =
    (isPhysical && (physical?.availability === "out_of_stock" || physical?.availability === "discontinued")) ||
    (isCourse && course?.enrollment_status === "closed") ||
    (isCourse && course?.enrollment_status === "full");

  const maxQuantity = physical?.max_purchase_quantity ?? undefined;
  const images = [
    ...(product.featured_image ? [{ id: 0, image: product.featured_image, alt_text: product.title, caption: null, order: -1 }] : []),
    ...product.gallery_images,
  ];
  const [activeImage, setActiveImage] = useState(0);

  async function handlePrimaryAction() {
    setSubmitting(true);
    setFeedback(null);
    try {
      await addItem(product.id, isCourse ? 1 : quantity);
      setFeedback({
        tone: "success",
        message: isCourse ? "دوره به سبد خرید اضافه شد." : "کالا به سبد خرید اضافه شد.",
      });
    } catch (reason) {
      setFeedback({ tone: "error", message: getApiErrorMessage(reason) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: product.title, url });
        return;
      } catch {
        // user cancelled share sheet -- fall through to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setFeedback({ tone: "success", message: "لینک محصول کپی شد." });
    }
  }

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-2 lg:pb-0">
      {/* Gallery */}
      <div>
        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#f4f1ea]">
          {images[activeImage]?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[activeImage].image ?? undefined}
              alt={images[activeImage].alt_text ?? product.title}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImage(index)}
                aria-label={`تصویر ${index + 1} از ${images.length}`}
                aria-current={index === activeImage}
                className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  index === activeImage ? "border-[#c98c3d]" : "border-transparent"
                }`}
              >
                {image.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.image} alt="" className="size-full object-cover" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div>
        {product.category ? (
          <Link href={`/shop?category=${product.category.slug}`} className="text-xs font-black text-[#c98c3d] hover:underline">
            {product.category.title}
          </Link>
        ) : null}
        <h1 className="mt-1 text-2xl font-black leading-[1.6] text-[#0a2848] md:text-3xl">{product.title}</h1>

        <div className="mt-4 flex items-center gap-3">
          {product.is_on_sale ? (
            <span className="text-sm font-bold text-[#0a2848]/40 line-through">{formatPrice(product.price_amount)}</span>
          ) : null}
          <span className="text-2xl font-black text-[#0a2848]">
            {formatPrice(product.is_on_sale ? product.sale_price_amount : product.price_amount)}
          </span>
        </div>

        {/* Availability / capacity */}
        <div className="mt-4">
          {isPhysical && physical ? (
            <p className={`text-sm font-black ${physical.availability === "in_stock" ? "text-emerald-600" : physical.availability === "low_stock" ? "text-amber-600" : "text-rose-600"}`}>
              {physical.availability === "in_stock"
                ? "موجود در انبار"
                : physical.availability === "low_stock"
                  ? "موجودی محدود"
                  : physical.availability === "preorder"
                    ? "پیش‌فروش"
                    : "ناموجود"}
            </p>
          ) : null}
          {isCourse && course ? (
            <div className="grid gap-1 text-sm font-bold text-[#0a2848]/75">
              {course.instructor_name ? <p>مدرس: {course.instructor_name}</p> : null}
              {course.start_date ? <p>شروع دوره: {jalaliDate(course.start_date)}</p> : null}
              {course.seats_left !== null ? (
                <p className={course.seats_left <= 5 ? "font-black text-amber-600" : ""}>
                  {course.seats_left > 0 ? `${new Intl.NumberFormat("fa-IR").format(course.seats_left)} صندلی باقی‌مانده` : "ظرفیت تکمیل شده"}
                </p>
              ) : null}
              {product.product_type === "in_person_course" && "unit" in course && course.unit ? (
                <p>واحد آموزشی: {course.unit.title}</p>
              ) : null}
              {product.product_type === "in_person_course" && "schedule_text" in course && course.schedule_text ? (
                <p>زمان‌بندی: {course.schedule_text}</p>
              ) : null}
              {product.product_type === "in_person_course" && "location_detail" in course && course.location_detail ? (
                <p>محل برگزاری: {course.location_detail}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {product.short_description ? (
          <p className="mt-4 text-sm font-bold leading-8 text-[#0a2848]/70">{product.short_description}</p>
        ) : null}

        {/* Purchase controls (desktop) */}
        <div className="mt-6 hidden lg:block">
          <PurchaseControls
            isPhysical={isPhysical}
            isCourse={isCourse}
            quantity={quantity}
            setQuantity={setQuantity}
            maxQuantity={maxQuantity}
            unavailable={Boolean(unavailable)}
            submitting={submitting}
            onSubmit={handlePrimaryAction}
            onShare={handleShare}
          />
          {feedback ? (
            <p role="status" className={`mt-3 text-sm font-bold ${feedback.tone === "success" ? "text-emerald-600" : "text-rose-600"}`}>
              {feedback.message}
            </p>
          ) : null}
        </div>

        {isPhysical && physical?.requires_shipping ? (
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#0a2848]/55">
            <Truck aria-hidden="true" className="size-4" />
            این کالا نیازمند ارسال فیزیکی است.
          </p>
        ) : null}
        {isCourse ? (
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#0a2848]/55">
            <GraduationCap aria-hidden="true" className="size-4" />
            دسترسی به دوره پس از تأیید پرداخت فعال می‌شود.
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#0a2848]/55">
          <ShieldCheck aria-hidden="true" className="size-4" />
          پرداخت امن از طریق درگاه بانکی
        </p>

        {/* Description */}
        {product.description ? (
          <div className="mt-8 border-t border-[#e5e7eb] pt-6">
            <h2 className="mb-3 text-base font-black text-[#0a2848]">توضیحات محصول</h2>
            <RichContentRenderer html={product.description} />
          </div>
        ) : null}
      </div>

      {/* Sticky mobile purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e7eb] bg-white p-3 shadow-[0_-8px_24px_rgba(15,37,58,.1)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-[#0a2848]/50">قیمت نهایی</p>
            <p className="text-base font-black text-[#0a2848]">
              {formatPrice(product.is_on_sale ? product.sale_price_amount : product.price_amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={submitting || unavailable}
            className="besat-accent-button flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {unavailable ? "ناموجود" : isCourse ? "ثبت‌نام دوره" : "افزودن به سبد"}
          </button>
        </div>
        {feedback ? (
          <p role="status" className={`mt-2 text-xs font-bold ${feedback.tone === "success" ? "text-emerald-600" : "text-rose-600"}`}>
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PurchaseControls({
  isPhysical,
  isCourse,
  quantity,
  setQuantity,
  maxQuantity,
  unavailable,
  submitting,
  onSubmit,
  onShare,
}: {
  isPhysical: boolean;
  isCourse: boolean;
  quantity: number;
  setQuantity: (value: number) => void;
  maxQuantity?: number;
  unavailable: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {isPhysical ? (
        <div className="flex items-center gap-1 rounded-xl border border-[#e5e7eb] px-1">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            aria-label="کاهش تعداد"
            className="flex size-10 items-center justify-center text-[#0a2848] disabled:opacity-30"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <span className="min-w-8 text-center text-sm font-black text-[#0a2848]">
            {new Intl.NumberFormat("fa-IR").format(quantity)}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(maxQuantity ? Math.min(maxQuantity, quantity + 1) : quantity + 1)}
            disabled={maxQuantity !== undefined && quantity >= maxQuantity}
            aria-label="افزایش تعداد"
            className="flex size-10 items-center justify-center text-[#0a2848] disabled:opacity-30"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || unavailable}
        className="besat-accent-button flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
      >
        {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {unavailable ? "ناموجود" : isCourse ? "ثبت‌نام دوره" : "افزودن به سبد خرید"}
      </button>

      <button
        type="button"
        onClick={onShare}
        aria-label="اشتراک‌گذاری این محصول"
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] text-[#0a2848] transition hover:bg-[#f4f1ea]"
      >
        <Share2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
