"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { isTopDialog, popDialog, pushDialog } from "@/lib/dialog-stack";

export type LightboxItem = {
  id: string | number;
  src: string;
  title: string;
  caption?: string | null;
};

type GalleryLightboxProps = {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate?: (nextIndex: number) => void;
};

const SWIPE_THRESHOLD_PX = 50;

export function GalleryLightbox({ items, index, onClose, onNavigate }: GalleryLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const item = items[index];

  useEffect(() => {
    // FE-GALLERY-LIGHTBOX-INVALID-INDEX-001: this effect used to run (and
    // lock scroll) even when `items[index]` has no entry -- e.g. `items=[]`
    // with a stale `index` left over from a prior render -- even though the
    // component then renders nothing at all (`if (!item) return null;`
    // below). That left the document permanently scroll-locked with no
    // visible dialog and no way to unlock it. Guarding the effect itself on
    // the same condition that gates the render keeps the two in sync.
    //
    // FE-GALLERY-UNSAFE-IMAGE-BLANK-LIGHTBOX-001 (same pattern, one layer
    // deeper): `item` can also exist but have an empty `src` -- the caller
    // (gallery-explorer.tsx) coerces a rejected media URL to `""` rather
    // than excluding the item, so it doesn't disturb index correspondence
    // with the rest of `items`. An item with no valid image is exactly as
    // unrenderable as a missing item, so the guard checks `item?.src`, not
    // just `item`'s own existence.
    if (!item?.src) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    // FE-MODAL-FOCUS-STACK-ORDER-001: lockBodyScroll()'s reference count
    // (not a capture-and-restore-the-prior-value scheme, this component's
    // previous approach per FE-MODAL-SCROLL-STACK-001) stays correct
    // regardless of the order concurrently open modals close in, not just
    // when they close in the exact reverse order they opened.
    const releaseScrollLock = lockBodyScroll();
    // FE-GALLERY-LIGHTBOX-ESCAPE-STACK-001: this listener used to close
    // unconditionally, with no awareness of another dialog (e.g. a CRUD
    // Modal) opened on top of it -- Modal/ConfirmDialog/useFocusTrap
    // already coordinate via this shared dialog-stack token and only act
    // on Escape when they're the topmost one.
    const dialogToken = pushDialog();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isTopDialog(dialogToken)) return;
        onClose();
        return;
      }
      // RTL layout: the "next" button sits on the visual left, "previous" on
      // the visual right, so the arrow keys are mapped to match screen
      // position rather than document/chronological direction.
      if (event.key === "ArrowLeft" && onNavigate && items.length > 1) {
        onNavigate((index + 1) % items.length);
        return;
      }
      if (event.key === "ArrowRight" && onNavigate && items.length > 1) {
        onNavigate((index - 1 + items.length) % items.length);
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      popDialog(dialogToken);
      releaseScrollLock();
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length, onClose, onNavigate, Boolean(item?.src)]);

  if (!item?.src || typeof document === "undefined") return null;

  function handleTouchStart(event: ReactTouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: ReactTouchEvent) {
    if (touchStartX.current === null || !onNavigate || items.length <= 1) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    // RTL layout: a leftward swipe (negative delta) moves to the next item.
    onNavigate(delta < 0 ? (index + 1) % items.length : (index - 1 + items.length) % items.length);
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      dir="rtl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
    >
      {/* Pointer-only backdrop close. Kept as a non-focusable div rather
          than a <button> so it's structurally excluded from both the Tab
          order and the focus trap's own querySelector below (which matches
          any `button`) -- a real close affordance already exists as the
          named, visible "بستن پیش‌نمایش" button, so this element has
          nothing meaningful to announce or focus. */}
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 -z-10 cursor-zoom-out"
      />

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="بستن پیش‌نمایش"
        className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:left-6 sm:top-6"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {onNavigate && items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => onNavigate((index - 1 + items.length) % items.length)}
            aria-label="تصویر قبلی"
            className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:right-6"
          >
            {/* Points right, outward toward the edge this button sits on. */}
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % items.length)}
            aria-label="تصویر بعدی"
            className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:left-6"
          >
            {/* Points left, outward toward the edge this button sits on. */}
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </>
      ) : null}

      <figure className="relative flex max-h-full max-w-5xl flex-col items-center gap-4">
        <img
          key={item.id}
          src={item.src}
          alt={item.title}
          className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
        />
        {/* The prev/next arrows are size-11 (2.75rem) positioned right-3/
            left-3 (0.75rem) from each edge, vertically centered on the
            whole dialog -- on a narrow viewport with a short image, the
            centered caption's own vertical position can land in that same
            band. Reserving 2.75rem + 0.75rem = 3.5rem (px-14) of horizontal
            space on each side keeps the caption text out of the arrows'
            actual footprint. Scoped to the caption only, not the figure,
            so the image itself keeps its own full available width. */}
        <figcaption className="max-w-2xl px-14 text-center text-sm font-bold text-white/85 sm:px-0">
          <span className="block text-base font-black text-white">{item.title}</span>
          {item.caption ? <span className="mt-1 block text-white/65">{item.caption}</span> : null}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
