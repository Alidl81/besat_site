import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { GalleryLightbox } from "@/components/gallery/gallery-lightbox";
import { Modal, ConfirmDialog } from "@/components/crud/crud-ui";
import { EventFormModal } from "@/components/dashboard/event-form-modal";

const items = [{ id: 1, src: "/one.jpg", title: "تصویر یک" }];

afterEach(() => {
  document.body.style.overflow = "";
  document.body.innerHTML = "";
});

// FE-MODAL-SCROLL-STACK-001: GalleryLightbox and Modal used to restore
// document.body.style.overflow to a hardcoded "" on close, clobbering a
// pre-existing lock from an outer dialog this one opened inside of.
// ConfirmDialog didn't lock scroll at all despite rendering a fixed
// role="dialog" confirmation surface.
describe("modal background scroll contract", () => {
  it("restores a pre-existing lock after a dedicated gallery lightbox closes", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = "hidden";

    const view = render(<GalleryLightbox items={items} index={0} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores a pre-existing lock after a CRUD modal closes", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = "hidden";

    const view = render(
      <Modal open title="نمونه" onClose={vi.fn()}>
        <p>محتوا</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does not lock scroll at all when the CRUD modal is closed", () => {
    const view = render(
      <Modal open={false} title="نمونه" onClose={vi.fn()}>
        <p>محتوا</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("locks background scrolling for a standalone destructive confirmation and restores it on close", () => {
    const view = render(
      <ConfirmDialog open title="حذف" description="تأیید حذف" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  // FE-MODAL-FOCUS-STACK-ORDER-001: the shared lockBodyScroll() reference
  // count keeps a lock held by one modal type intact while a DIFFERENT
  // modal type opened on top of it closes first -- not just the two
  // same-type-nested cases the earlier capture/restore fix happened to
  // cover.
  it("keeps the lock held when a CRUD modal opened on top of a gallery lightbox closes first", () => {
    const lightbox = render(<GalleryLightbox items={items} index={0} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");

    const modal = render(
      <Modal open title="نمونه" onClose={vi.fn()}>
        <p>محتوا</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    modal.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    lightbox.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  // FE-EVENT-MODAL-SCROLL-STACK-001: EventFormModal hand-rolled its own
  // capture-and-restore-the-prior-value scroll lock (a defect the audit for
  // FE-MODAL-FOCUS-STACK-ORDER-001 missed since it stores the field via
  // `const body = document.body; ... body.style.overflow`, not the literal
  // `document.body.style.overflow` string the original grep searched for).
  it("keeps the lock held when a CRUD modal opened on top of the event form modal closes first", () => {
    function Harness({ eventOpen, modalOpen }: { eventOpen: boolean; modalOpen: boolean }) {
      return (
        <>
          {eventOpen ? (
            <EventFormModal
              open
              onClose={vi.fn()}
              onSaved={vi.fn()}
              event={null}
              isGeneralManager
              fixedUnitId={null}
              units={[]}
            />
          ) : null}
          {modalOpen ? (
            <Modal open title="outer" onClose={vi.fn()}>
              <p>outer content</p>
            </Modal>
          ) : null}
        </>
      );
    }

    const view = render(<Harness eventOpen modalOpen={false} />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness eventOpen modalOpen />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness eventOpen={false} modalOpen />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<Harness eventOpen={false} modalOpen={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  // FE-MODAL-ESCAPE-STACK-001: EventFormModal's own Escape listener used to
  // fire unconditionally regardless of any OTHER dialog opened on top of
  // it -- a Modal launched from inside this one is the genuinely topmost
  // surface, so Escape must close THAT, not the outer EventFormModal
  // (which this test previously, incorrectly, asserted). Joining the same
  // dialog-stack token coordination Modal/ConfirmDialog already use fixes
  // this -- EventFormModal now correctly declines to act when it isn't
  // the topmost dialog.
  it("closes only the topmost dialog when EventFormModal and Modal overlap", () => {
    const eventClose = vi.fn();
    const modalClose = vi.fn();
    render(
      <>
        <EventFormModal
          open
          onClose={eventClose}
          onSaved={vi.fn()}
          event={null}
          isGeneralManager
          fixedUnitId={null}
          units={[]}
        />
        <Modal open title="nested" onClose={modalClose}>
          <p>nested content</p>
        </Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    // Modal opens after EventFormModal and is therefore the topmost surface.
    expect(eventClose).not.toHaveBeenCalled();
    expect(modalClose).toHaveBeenCalledTimes(1);
  });
});
