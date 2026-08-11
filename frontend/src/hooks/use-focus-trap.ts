"use client";

import { useEffect, type RefObject } from "react";

/**
 * Traps Tab focus inside `containerRef` while `active`, closes on Escape,
 * locks background scroll, and restores focus to `restoreFocusRef` (or
 * whatever had focus before opening) on close. Extracted from the
 * pattern already used by site-header.tsx's mobile drawer so a third
 * copy (the shop cart drawer) doesn't duplicate it again.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
  restoreFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
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

    window.addEventListener("keydown", onKeyDown);
    const elementToRestore = restoreFocusRef?.current ?? previouslyFocused;
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      elementToRestore?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
