"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, Loader2, Minus, Plus, Share2, ShieldCheck, Truck } from "lucide-react";
import { RichContentRenderer } from "@/components/content/rich-content-renderer";
import { useShopCart } from "@/lib/shop/cart-context";
import { formatPrice } from "@/lib/shop/money";
import { getApiErrorMessage } from "@/lib/api/client";
import { useMounted } from "@/hooks/use-mounted";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
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
  const mounted = useMounted();
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const isPhysical = product.product_type === "physical";
  const isCourse = product.product_type === "online_course" || product.product_type === "in_person_course";
  const physical = product.physical_detail;
  const course = product.course_detail;

  const hasVariants = product.variants.length > 0;
  const [variantId, setVariantId] = useState<number | null>(
    () => product.variants.find((variant) => variant.in_stock)?.id ?? product.variants[0]?.id ?? null,
  );

  // FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001: `variantId`'s (and every other
  // product-scoped state's) initial value above only runs once, at mount
  // -- if the App Router reuses this same component instance across an
  // A -> B product navigation (a new `product` prop on a re-render, not a
  // remount), none of this state ever re-derives from the new product.
  // The previous product's variant selection stayed selected under the
  // new product's completely unrelated variant list (or `null` if the new
  // product's variant ids don't happen to collide), so "افزودن به سبد
  // خرید" could submit a variant that doesn't belong to the product on
  // screen, or no variant at all. Reconciling here, during render,
  // whenever `product.id` itself changes is React's own documented
  // render-phase state-adjustment pattern for this exact situation
  // ("resetting state when a prop changes") -- tracked via a *state*
  // comparison rather than a ref, since this project's stricter
  // react-hooks/refs lint rule forbids reading/writing a ref's `.current`
  // during render (see FE-AUTH-SET-PASSWORD-TOKEN-RERENDER-001 and
  // FE-SHOP-ORDER-DETAIL-STALE-NAV-001 for the same constraint, hit
  // earlier this same session).
  const [prevProductId, setPrevProductId] = useState(product.id);
  if (product.id !== prevProductId) {
    setPrevProductId(product.id);
    setQuantity(1);
    setSubmitting(false);
    setFeedback(null);
    setActiveImage(0);
    setVariantId(product.variants.find((variant) => variant.in_stock)?.id ?? product.variants[0]?.id ?? null);
  }

  const selectedVariant = hasVariants ? product.variants.find((variant) => variant.id === variantId) ?? null : null;
  // Tracking focus explicitly in state rather than relying on a CSS
  // `:focus`/`:focus-visible`/`has-[:focus]` selector -- two attempts at
  // the latter (see FE-PRODUCT-VARIANT-002 history) didn't reliably
  // render under independent browser retest, for reasons I couldn't
  // fully pin down. This removes that uncertainty entirely: the ring is
  // driven by an actual React state flip on the same onFocus/onBlur that
  // already exists for the scroll-into-view behavior.
  const [focusedVariantId, setFocusedVariantId] = useState<number | null>(null);
  const variantGroupRef = useRef<HTMLFieldSetElement>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);

  // scrollIntoView({block:"nearest"}) turned out not to work for this:
  // the element's real (un-inflated) box is already within the raw
  // viewport bounds, so the browser's own "is this already visible"
  // check says yes and scrolls zero pixels -- it has no way to know an
  // unrelated fixed-position bar is painted on top of that space. scroll-
  // margin is supposed to inflate that check, but did not move anything
  // in an actual browser retest either. Doing the scroll math explicitly
  // instead: measure the real gap and window.scrollBy it, with no
  // dependency on how the browser interprets margins/"nearest".
  //
  // The browser's *own* native "scroll focus target into view" behavior
  // also fires on Tab (apparently keyed off the sr-only radio's
  // degenerate 1x1 geometry, or off whatever the previously-focused
  // control was on Shift+Tab) -- and per measured evidence it isn't a
  // synchronous jump, it's a *smooth-animated* scroll that keeps moving
  // for 600ms+ after the focus event (measured scrollY climbing
  // 449->700->779->946->948 over ~640ms). A fixed short defer (originally
  // two animation frames, ~32ms) fires while that animation is still in
  // progress, so the correction below would apply and then immediately
  // get overridden by the animation continuing afterward. Waiting for
  // actual scroll events to stop (rather than assuming any specific
  // delay is "long enough") is the only way to reliably run after
  // whatever the browser's native behavior is doing, however long it
  // takes.
  //
  // Bidirectional: Tab forward past the group then Shift+Tab back can
  // return focus after the page has scrolled far down for whatever
  // control was focused in between (portaling the mobile bar to
  // <body> moves it to the end of the DOM, and DOM order is tab order,
  // so "the next control" after this group can be much further down
  // the page than it looks) -- landing the radio's real position well
  // *above* the viewport, not just behind the bar.
  function scrollAboveMobileBar(element: HTMLElement | null) {
    function applyCorrection() {
      const bar = mobileBarRef.current;
      if (!element || !bar) return;
      const barHeight = bar.getBoundingClientRect().height;
      if (barHeight <= 0) return; // bar is lg:hidden -- desktop, nothing to do
      const rect = element.getBoundingClientRect();
      const visibleBottom = window.innerHeight - barHeight;
      if (rect.bottom > visibleBottom) {
        window.scrollBy({ top: rect.bottom - visibleBottom + 12, behavior: "auto" });
      } else if (rect.top < 0) {
        window.scrollBy({ top: rect.top - 12, behavior: "auto" });
      }
    }

    let settleTimer: ReturnType<typeof setTimeout>;
    function onScroll() {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        window.removeEventListener("scroll", onScroll);
        applyCorrection();
      }, 150);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // Also arms the same settle timer immediately, in case the native
    // behavior never fires a scroll event at all (nothing to wait for).
    onScroll();
  }

  // On first paint, correct for the case where the variant group happens
  // to render right where the fixed mobile purchase bar sits (this only
  // depends on how much content is above it -- image gallery height,
  // description length -- not on anything a user did). Only runs once
  // real geometry exists (`mounted`).
  useEffect(() => {
    if (!mounted || !hasVariants) return;
    scrollAboveMobileBar(variantGroupRef.current);
  }, [mounted, hasVariants]);

  const unavailable =
    (isPhysical && (physical?.availability === "out_of_stock" || physical?.availability === "discontinued")) ||
    (isCourse && course?.enrollment_status === "closed") ||
    (isCourse && course?.enrollment_status === "full") ||
    (hasVariants && !selectedVariant?.in_stock);

  const maxQuantity = physical?.max_purchase_quantity ?? undefined;
  const images = [
    ...(product.featured_image ? [{ id: 0, image: product.featured_image, alt_text: product.title, caption: null, order: -1 }] : []),
    ...product.gallery_images,
  ].map((image) => ({ ...image, image: safePublicMediaUrl(image.image) }));
  // FE-SHOP-PRODUCT-ADD-DOUBLE-SUBMIT-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={submitting}`
  // only takes effect after React re-renders, so two clicks dispatched
  // before that render (the desktop button and the portaled sticky mobile
  // bar's button both call the same handler) both start handlePrimaryAction.
  const submittingRef = useRef(false);
  // FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001: submittingRef can't be reset in
  // the render-phase block above (ref writes during render are
  // disallowed), so an effect handles it instead -- safe since
  // submittingRef is only ever read inside handlePrimaryAction, a later
  // user-triggered event, never during render. Without this, navigating
  // to a new product while a prior product's add-to-cart request is still
  // in flight would leave submittingRef permanently `true`, silently
  // blocking the new product's own add-to-cart button forever.
  //
  // FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001 (REOPENED, in-flight case):
  // resetting submittingRef here already lets the *new* product's button
  // accept a fresh add-to-cart click -- but the *old* product's
  // still-in-flight addItem() call keeps running regardless, and its own
  // `await` continuation used to call setFeedback()/setSubmitting()
  // unconditionally once it settled, silently flipping whatever product
  // is now on screen to a stale success/error message (or, worse,
  // clearing a genuinely in-progress *new* submission's own `submitting`
  // state out from under it).
  //
  // FE-SHOP-PRODUCT-DETAIL-REENTRY-RACE-001 (REOPENED again): fencing on
  // `product.id` alone isn't enough -- an A -> B -> A re-entry (the user
  // navigates away and back to the *same* product) produces two visits
  // that share the identical id, so a stale completion from the FIRST
  // visit's request incorrectly passes an id-only check once the user is
  // back on A again for the second time. visitGenerationRef is a plain
  // counter bumped on every product change, including a change back to a
  // previously-seen id -- unlike product.id, it distinguishes "this exact
  // visit" from "an earlier visit to the same product," so only a
  // completion whose own visit is still the active one is applied.
  const visitGenerationRef = useRef(0);
  useEffect(() => {
    visitGenerationRef.current += 1;
    submittingRef.current = false;
  }, [product.id]);

  async function handlePrimaryAction() {
    if (submittingRef.current) return;
    const forVisit = visitGenerationRef.current;
    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      await addItem(product.id, isCourse ? 1 : quantity, hasVariants ? variantId : null);
      if (visitGenerationRef.current !== forVisit) return;
      setFeedback({
        tone: "success",
        message: isCourse ? "دوره به سبد خرید اضافه شد." : "کالا به سبد خرید اضافه شد.",
      });
    } catch (reason) {
      if (visitGenerationRef.current !== forVisit) return;
      setFeedback({ tone: "error", message: getApiErrorMessage(reason) });
    } finally {
      if (visitGenerationRef.current === forVisit) {
        setSubmitting(false);
        submittingRef.current = false;
      }
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
    <>
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
          // FE-A11Y-CONTRAST-HOME-NEWS-001 (same defect pattern, proactively
          // applied here too): same failing color/white-background pairing.
          <Link href={`/shop?category=${product.category.slug}`} className="text-xs font-black text-[#8a641f] hover:underline">
            {product.category.title}
          </Link>
        ) : null}
        <h1 className="mt-1 text-2xl font-black leading-[1.6] text-[#0a2848] md:text-3xl">{product.title}</h1>

        <div className="mt-4 flex items-center gap-3">
          {selectedVariant ? (
            <span className="text-2xl font-black text-[#0a2848]">
              {selectedVariant.price_display ?? formatPrice(selectedVariant.price_amount)}
            </span>
          ) : (
            <>
              {/* FE-SHOP-A11Y-CONTRAST-001: /40 computed to #9da9b6 on white, 2.39:1
                  (needs 4.5:1 for 14px bold text). Aligned to the /70 opacity
                  product-card.tsx already uses for this identical old-price element. */}
              {product.is_on_sale ? (
                <span className="text-sm font-bold text-[#0a2848]/70 line-through">{formatPrice(product.price_amount)}</span>
              ) : null}
              <span className="text-2xl font-black text-[#0a2848]">
                {formatPrice(product.is_on_sale ? product.sale_price_amount : product.price_amount)}
              </span>
            </>
          )}
        </div>

        {/* Availability / capacity */}
        <div className="mt-4">
          {isPhysical && physical ? (
            <p className={`text-sm font-black ${physical.availability === "in_stock" ? "text-emerald-600" : physical.availability === "low_stock" ? "text-amber-800" : "text-rose-600"}`}>
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
                <p className={course.seats_left <= 5 ? "font-black text-amber-800" : ""}>
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

        {/* Variant selector -- visible in normal page flow on both desktop
            and mobile (mobile users scroll past this before reaching the
            sticky add bar), rather than crammed into the sticky bar.
            The onFocus handler keeps a focused option clear of the
            opaque bar (a fixed overlay doesn't trigger the browser's own
            native focus-scroll, since that only reacts to actual
            scroll-out, not paint-order occlusion by unrelated fixed
            content -- and scrollIntoView({block:"nearest"}) alone
            doesn't help either, see scrollAboveMobileBar above). Using
            has-[:focus] rather than has-[:focus-visible] for the ring:
            the latter didn't reliably reflect keyboard focus under
            automated retest. */}
        {hasVariants ? (
          <fieldset ref={variantGroupRef} className="mt-5">
            <legend className="mb-3 text-sm font-black text-[#0a2848]">انتخاب گزینه</legend>
            <div role="radiogroup" aria-label="گزینه‌های محصول" className="flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <label
                  key={variant.id}
                  className={`relative flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                    variantId === variant.id
                      ? "border-[#c98c3d] bg-[#fbf3e7] text-[#0a2848]"
                      : "border-[#e5e7eb] text-[#0a2848]/80 hover:border-[#c98c3d]/50"
                  } ${!variant.in_stock ? "cursor-not-allowed opacity-40" : ""} ${
                    focusedVariantId === variant.id ? "ring-4 ring-[#c98c3d]/60 ring-offset-2" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="product-variant"
                    value={variant.id}
                    checked={variantId === variant.id}
                    disabled={!variant.in_stock}
                    onChange={() => setVariantId(variant.id)}
                    onFocus={(event) => {
                      setFocusedVariantId(variant.id);
                      scrollAboveMobileBar(event.currentTarget.closest("label"));
                    }}
                    onBlur={() => setFocusedVariantId((current) => (current === variant.id ? null : current))}
                    className="sr-only"
                  />
                  {variant.title}
                  {!variant.in_stock ? <span className="text-xs font-bold text-rose-500">(ناموجود)</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
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
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#0a2848]/70">
            <Truck aria-hidden="true" className="size-4" />
            این کالا نیازمند ارسال فیزیکی است.
          </p>
        ) : null}
        {isCourse ? (
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[#0a2848]/70">
            <GraduationCap aria-hidden="true" className="size-4" />
            دسترسی به دوره پس از تأیید پرداخت فعال می‌شود.
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#0a2848]/70">
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
    </div>

    {/* Sticky mobile purchase bar -- portaled to <body>: this page's
        content sits inside <main class="besat-page-enter"> (a transform
        animation ancestor) and PublicPageLayout's overflow-x-clip wrapper,
        either of which independently traps position:fixed descendants
        instead of anchoring them to the viewport (same failure family as
        the cart drawer's FE-CART-001 fix). Portaling sidesteps both.
        Gated on `mounted`, not rendered until after the first client
        render, because `document.body` doesn't exist during SSR at all
        (unlike a plain nested element, this can't just render server-side
        like normal). */}
    {mounted && createPortal(
      <div
        ref={mobileBarRef}
        role="region"
        aria-label="نوار خرید"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e7eb] bg-white p-3 shadow-[0_-8px_24px_rgba(15,37,58,.1)] lg:hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#0a2848]/70">قیمت نهایی</p>
            <p className="truncate text-base font-black text-[#0a2848]">
              {selectedVariant
                ? selectedVariant.price_display ?? formatPrice(selectedVariant.price_amount)
                : formatPrice(product.is_on_sale ? product.sale_price_amount : product.price_amount)}
            </p>
          </div>
          {isPhysical ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#e5e7eb] px-0.5">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="کاهش تعداد"
                className="flex size-9 items-center justify-center text-[#0a2848] disabled:opacity-30"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-black tabular-nums text-[#0a2848]">
                {new Intl.NumberFormat("fa-IR").format(quantity)}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(maxQuantity ? Math.min(maxQuantity, quantity + 1) : quantity + 1)}
                disabled={maxQuantity !== undefined && quantity >= maxQuantity}
                aria-label="افزایش تعداد"
                className="flex size-9 items-center justify-center text-[#0a2848] disabled:opacity-30"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={submitting || unavailable}
            className="besat-accent-button flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {unavailable
              ? "ناموجود"
              : submitting
                ? (isCourse ? "در حال ثبت‌نام..." : "در حال افزودن...")
                : isCourse ? "ثبت‌نام دوره" : "افزودن به سبد"}
          </button>
        </div>
        {feedback ? (
          <p role="status" className={`mt-2 text-xs font-bold ${feedback.tone === "success" ? "text-emerald-600" : "text-rose-600"}`}>
            {feedback.message}
          </p>
        ) : null}
      </div>,
      document.body,
    )}
    </>
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
        {unavailable
          ? "ناموجود"
          : submitting
            ? (isCourse ? "در حال ثبت‌نام..." : "در حال افزودن...")
            : isCourse ? "ثبت‌نام دوره" : "افزودن به سبد خرید"}
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
