// FE-MODAL-FOCUS-STACK-ORDER-001: every consumer of body-scroll locking
// (useFocusTrap, GalleryLightbox, Modal, ConfirmDialog, MediaPickerDialog)
// used to hand-roll the same "capture document.body.style.overflow before
// locking, restore exactly that value on cleanup" pattern -- correct only
// when callers close in the exact reverse order they opened (LIFO). It
// silently breaks for any other ordering: with an outer dialog open
// (capturing "" and setting "hidden") and an inner one opened on top of it
// (capturing "hidden", a no-op re-lock), closing the OUTER dialog first --
// not the inner -- runs the outer's cleanup, which restores its own
// captured "" and clobbers the inner dialog's still-active lock even though
// the inner dialog is still open.
//
// A reference count sidesteps this entirely: only the very first lock() in
// a stack needs to remember the pre-lock value, and only the release() that
// brings the count back to zero needs to restore it -- the order calls
// happen in, and how many consumers are active at once, no longer matters.
let lockCount = 0;
let previousOverflow = "";

/** Locks document scroll (idempotently stacking across concurrent callers)
 * and returns a one-shot release function. Call the returned function
 * exactly once, typically from a `useEffect` cleanup, when this particular
 * caller no longer needs the lock. */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
    }
  };
}
