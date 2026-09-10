import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GalleryLightbox } from "@/components/gallery/gallery-lightbox";
import { Modal } from "@/components/crud/crud-ui";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// FE-GALLERY-LIGHTBOX-INVALID-INDEX-001: the scroll-lock effect used to run
// (and lock scroll) even when `items[index]` has no entry -- e.g. a stale
// `index` left over after the parent's selection list shrank to `[]` --
// even though the component renders nothing at all in that case, leaving
// the document permanently scroll-locked with no visible dialog and no way
// to unlock it.
describe("GalleryLightbox invalid selection lifecycle", () => {
  it("does not lock document scrolling when the selected index has no item", () => {
    document.body.style.overflow = "";

    render(<GalleryLightbox items={[]} index={0} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("still locks scrolling normally once a valid item is selected", () => {
    render(
      <GalleryLightbox
        items={[{ id: 1, src: "/one.jpg", title: "تصویر یک" }]}
        index={0}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  // FE-GALLERY-UNSAFE-IMAGE-BLANK-LIGHTBOX-001 (same pattern, one layer
  // deeper): an item can also exist at `index` but carry an empty `src` --
  // gallery-explorer.tsx coerces a rejected media URL to "" rather than
  // excluding the item, so it doesn't disturb index correspondence with
  // the rest of `items`. That's exactly as unrenderable as a missing item,
  // so both the scroll-lock effect and the render now check `item?.src`,
  // not just whether `item` itself exists.
  it("does not lock document scrolling or render a blank dialog for an item with no valid image", () => {
    render(
      <GalleryLightbox
        items={[{ id: 1, src: "", title: "رکورد تصویر نامعتبر" }]}
        index={0}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector('img[src=""]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

// FE-GALLERY-LIGHTBOX-ESCAPE-STACK-001: this lightbox's Escape listener
// used to close unconditionally, with no awareness of another dialog (e.g.
// a CRUD Modal) opened on top of it -- Modal/ConfirmDialog/useFocusTrap
// already coordinate via a shared dialog-stack token and only act on
// Escape when they're the topmost one; this lightbox never joined that
// coordination at all, so one Escape press closed both dialogs at once.
describe("GalleryLightbox dialog-stack Escape ownership", () => {
  it("does not close a lightbox underneath a later topmost Modal", () => {
    const lightboxClose = vi.fn();
    const modalClose = vi.fn();

    render(
      <>
        <GalleryLightbox
          items={[{ id: 1, src: "/one.jpg", title: "تصویر یک" }]}
          index={0}
          onClose={lightboxClose}
        />
        <Modal open title="topmost" onClose={modalClose}>
          <p>modal content</p>
        </Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(lightboxClose).not.toHaveBeenCalled();
    expect(modalClose).toHaveBeenCalledTimes(1);
  });
});
