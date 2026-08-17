"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";

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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && onNavigate && items.length > 1) {
        onNavigate((index - 1 + items.length) % items.length);
        return;
      }
      if (event.key === "ArrowRight" && onNavigate && items.length > 1) {
        onNavigate((index + 1) % items.length);
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
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [index, items.length, onClose, onNavigate]);

  if (!item || typeof document === "undefined") return null;

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
      <button
        type="button"
        aria-label="بستن"
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
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % items.length)}
            aria-label="تصویر بعدی"
            className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:left-6"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
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
        <figcaption className="max-w-2xl text-center text-sm font-bold text-white/85">
          <span className="block text-base font-black text-white">{item.title}</span>
          {item.caption ? <span className="mt-1 block text-white/65">{item.caption}</span> : null}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
