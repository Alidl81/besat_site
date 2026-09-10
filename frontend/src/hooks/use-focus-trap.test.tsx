import { useRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Modal } from "@/components/crud/crud-ui";

function Trap({ active, label }: { active: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, () => undefined);
  return active ? (
    <div ref={ref} role="dialog" aria-label={label}>
      <button type="button">بستن</button>
    </div>
  ) : null;
}

function Harness({ outer, inner }: { outer: boolean; inner: boolean }) {
  return (
    <>
      <Trap active={outer} label="outer" />
      <Trap active={inner} label="inner" />
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
  document.body.innerHTML = "";
});

// FE-MODAL-FOCUS-STACK-ORDER-001: a capture-and-restore-the-prior-value
// scroll lock (this hook's previous approach) is only correct when every
// active trap closes in the exact reverse order it opened. lockBodyScroll()
// (frontend/src/lib/body-scroll-lock.ts) replaces that with a reference
// count, which stays correct for any closing order.
describe("shared focus-trap stack ordering", () => {
  it("keeps the body locked when an outer trap closes before an inner trap", () => {
    const view = render(<Harness outer inner />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness outer={false} inner />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness outer={false} inner={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the body locked when an inner trap closes before an outer trap (the already-working LIFO order)", () => {
    const view = render(<Harness outer inner />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness outer inner={false} />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness outer={false} inner={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("does not touch a pre-existing lock from outside this hook until the last consumer releases", () => {
    document.body.style.overflow = "hidden";

    const view = render(<Harness outer inner />);
    expect(document.body.style.overflow).toBe("hidden");

    view.unmount();
    expect(document.body.style.overflow).toBe("hidden");
  });
});

// FE-MODAL-ESCAPE-STACK-001: this hook used to listen for Escape with no
// awareness of any OTHER dialog opened on top of it -- unlike Modal/
// ConfirmDialog (crud-ui.tsx), which already coordinate via a shared
// dialog-stack token and only act when they're the topmost dialog. One
// Escape press with a Modal opened on top of a useFocusTrap-based dialog
// fired BOTH callbacks at once instead of only the topmost one.
describe("useFocusTrap dialog-stack Escape ownership", () => {
  function HookDialog({ onClose }: { onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(ref, true, onClose);
    return (
      <div ref={ref} role="dialog" aria-label="hook dialog">
        <button type="button">hook close</button>
      </div>
    );
  }

  it("does not close a hook dialog underneath a later topmost Modal", () => {
    const hookClose = vi.fn();
    const modalClose = vi.fn();

    render(
      <>
        <HookDialog onClose={hookClose} />
        <Modal open title="topmost" onClose={modalClose}>
          <p>modal content</p>
        </Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(hookClose).not.toHaveBeenCalled();
    expect(modalClose).toHaveBeenCalledTimes(1);
  });
});
