"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { isTopDialog, popDialog, pushDialog } from "@/lib/dialog-stack";

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
  // FE-REGISTRATION-NOTE-PENDING-ESCAPE-001: the effect below only
  // re-runs when `active` changes, so a plain `onClose` reference read
  // directly inside its `onKeyDown` closure stays frozen at whatever
  // closure the caller passed on the render that activated the trap --
  // even though the caller re-renders with a fresh closure every time
  // (e.g. one that reads a `working`/`submitting` flag to decide whether
  // Escape should be allowed to close at all). A caller passing a stale
  // "always allow close" version of that closure could dismiss the dialog
  // via Escape mid-submission, even though the SAME caller's own Cancel
  // button and backdrop-click handler correctly block that. Mirrors the
  // `onCloseRef`/`onCancelRef` pattern crud-ui.tsx's Modal/ConfirmDialog
  // already use for this exact reason.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // FE-MODAL-FOCUS-STACK-ORDER-001: a capture-and-restore-the-prior-value
    // scheme (this hook's previous approach, per FE-CIRCULAR-MODAL-A11Y-001)
    // only stays correct when every active trap closes in the exact reverse
    // order it opened -- it breaks when an outer trap closes while an inner
    // one is still active, since the outer's cleanup restores its own
    // captured pre-lock value and clobbers the inner trap's still-active
    // lock. lockBodyScroll()'s reference count fixes this for any closing
    // order, not just LIFO.
    const releaseScrollLock = lockBodyScroll();

    // FE-MODAL-ESCAPE-STACK-001: this hook used to listen for Escape
    // unconditionally, with no awareness of any OTHER dialog that might be
    // open on top of it -- Modal/ConfirmDialog (crud-ui.tsx) already
    // register with this same dialog-stack token and only act on Escape
    // when they're the topmost one, but this hook never joined that
    // coordination at all. One Escape press with, say, a Modal opened from
    // inside a useFocusTrap-based dialog fired BOTH callbacks at once
    // instead of only the topmost dialog's.
    const dialogToken = pushDialog();

    // FE-CART-FOCUS-ASYNC-001: querySelectorAll returns a static snapshot,
    // not a live collection -- computing it once here captured whatever
    // was in the DOM at the exact moment `active` became true (e.g. just
    // the close button, while cart contents were still loading). Content
    // that mounts asynchronously afterward was invisible to the trap, so
    // Tab could never reach it and kept wrapping back to the stale
    // boundary. Recomputing fresh on every keydown instead makes the trap
    // always reflect whatever is actually in the container right now.
    function getFocusable() {
      return containerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    }

    getFocusable()?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isTopDialog(dialogToken)) return;
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable?.length) return;
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
      releaseScrollLock();
      window.removeEventListener("keydown", onKeyDown);
      popDialog(dialogToken);
      elementToRestore?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
