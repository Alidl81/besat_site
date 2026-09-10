import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichContentRenderer } from "@/components/content/rich-content-renderer";
import { Modal } from "@/components/crud/crud-ui";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// FE-RICH-GALLERY-NONINTERACTIVE-001: a non-lightbox gallery item used to
// still render as a focusable, named <button> whose onClick silently did
// nothing (guarded internally with `if (!lightbox) return`) -- a dead
// control for keyboard/screen-reader users.
describe("RichContentRenderer gallery interactivity contract", () => {
  it("does not expose a non-lightbox gallery item as a button", () => {
    render(
      <RichContentRenderer
        html='<section data-besat-block="gallery" data-lightbox="false"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="تصویر بدون نمایشگر"></div></section>'
      />,
    );

    expect(screen.queryByRole("button", { name: "تصویر بدون نمایشگر" })).not.toBeInTheDocument();
    expect(screen.getByAltText("")).toBeInTheDocument();
  });

  it("still exposes a lightbox-enabled gallery item as a real button", () => {
    render(
      <RichContentRenderer
        html='<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="تصویر با نمایشگر"></div></section>'
      />,
    );

    expect(screen.getByRole("button", { name: "تصویر با نمایشگر" })).toBeInTheDocument();
  });
});

// FE-RICH-GALLERY-MANUAL-STACK-001: GalleryBlock's and ImageBlock's inline
// lightboxes each hand-rolled the same capture-and-restore-the-prior-value
// scroll lock already fixed elsewhere (FE-MODAL-FOCUS-STACK-ORDER-001) --
// correct only when every active lock closes in the exact reverse order it
// opened. With two of these inline lightboxes open at once (two separate
// CMS gallery blocks on the same page), closing the first one before the
// second left the second still open but scrolling unlocked.
describe("rich gallery lightbox body-lock stacking", () => {
  it("keeps the second inline lightbox locked when the first closes out of order", () => {
    render(
      <RichContentRenderer
        html={[
          '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="گالری اول"></div></section>',
          '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/b.jpg" data-title="گالری دوم"></div></section>',
        ].join("")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "گالری اول" }));
    fireEvent.click(screen.getByRole("button", { name: "گالری دوم" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getAllByRole("button", { name: "بستن" })[0]);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(document.body.style.overflow).toBe("hidden");
  });
});

// FE-RICH-LIGHTBOX-ESCAPE-STACK-001: GalleryBlock's and ImageBlock's inline
// lightboxes each installed an independent document Escape listener with no
// dialog-stack awareness -- Modal/ConfirmDialog/useFocusTrap/GalleryLightbox
// already coordinate via a shared token and only act on Escape when they're
// the topmost one; these two never joined that coordination, so one Escape
// press closed both an outer Modal and the inline lightbox at once.
//
// Consistent with the shared "most-recently-opened dialog is topmost and
// owns Escape" convention already established and tested elsewhere in this
// fix family (FE-MODAL-ESCAPE-STACK-001's use-focus-trap.test.tsx /
// modal-scroll-lock.test.tsx, and gallery-lightbox.test.tsx's own dialog-
// stack case): the Modal here is already open when the tree first mounts,
// so its token is pushed first; the inline lightbox only opens afterward
// via a click, pushing its token second (topmost). Escape therefore closes
// the inline lightbox and leaves the earlier Modal alone.
describe("rich lightbox dialog-stack Escape ownership", () => {
  it("does not close an outer Modal when a later-opened inline gallery lightbox is topmost", () => {
    const modalClose = vi.fn();

    render(
      <>
        <RichContentRenderer
          html='<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="گالری"></div></section>'
        />
        <Modal open title="earlier" onClose={modalClose}>
          <p>modal content</p>
        </Modal>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "گالری" }));
    expect(screen.getByRole("dialog", { name: "گالری" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "گالری" })).not.toBeInTheDocument();
    expect(modalClose).not.toHaveBeenCalled();
  });

  it("does not close an outer Modal when a later-opened single-image lightbox is topmost", () => {
    const modalClose = vi.fn();

    render(
      <>
        <RichContentRenderer
          html='<figure data-besat-block="image" data-lightbox="true"><img src="/media/a.jpg" alt="تصویر"></figure>'
        />
        <Modal open title="earlier" onClose={modalClose}>
          <p>modal content</p>
        </Modal>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "تصویر" }));
    expect(screen.getByRole("dialog", { name: "تصویر" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "تصویر" })).not.toBeInTheDocument();
    expect(modalClose).not.toHaveBeenCalled();
  });
});

// FE-RICH-GALLERY-LIST-SHRINK-LOCK-001: when a re-render shrinks `items`
// such that the open `activeIndex` no longer points at a real item,
// `activeItem` becomes `undefined` and the dialog JSX stops rendering --
// but the isOpen-keyed effect that owns the scroll lock and dialog-stack
// token never re-ran, since `activeIndex` itself was still non-null. The
// dialog visually disappeared while the body stayed locked and a stale
// token remained on the shared Escape stack. Fixed by explicitly closing
// (setActiveIndex(null)) once activeIndex goes out of bounds, routing
// through the same close path a normal Escape/close-button click uses.
describe("rich gallery lightbox when the backing item list shrinks", () => {
  it("does not leave body scroll locked or a dialog-stack token behind an invalid active item", () => {
    const firstHtml = '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="اول"></div><div data-besat-gallery-item data-src="/media/b.jpg" data-title="دوم"></div></section>';
    const { rerender } = render(<RichContentRenderer html={firstHtml} />);

    fireEvent.click(screen.getByRole("button", { name: "دوم" }));
    expect(screen.getByRole("dialog", { name: "دوم" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    const reducedHtml = '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="اول"></div></section>';
    rerender(<RichContentRenderer html={reducedHtml} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});

// FE-RICH-GALLERY-SHRINK-REGROW-001: the first version of the shrink-lock
// fix above redefined `isOpen` as a *derived* value (`activeIndex !== null
// && activeIndex < items.length`) without touching `activeIndex` itself.
// That correctly closed the dialog and released the lock/token when items
// shrank, but left the stale `activeIndex` sitting in state -- so if items
// later grew back to include that same index, it silently became "valid"
// again and the old lightbox reopened with no new click from the user.
// activeIndex is now nulled out during render (not from an effect) the
// moment it goes out of bounds, so regrowth starts from a genuinely closed
// state and requires a real activation to reopen.
describe("rich gallery lightbox after a backing list shrink and regrow", () => {
  it("does not reopen an invalidated lightbox without a new user activation", () => {
    const fullHtml = '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="اول"></div><div data-besat-gallery-item data-src="/media/b.jpg" data-title="دوم"></div></section>';
    const reducedHtml = '<section data-besat-block="gallery" data-lightbox="true"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="اول"></div></section>';
    const { rerender } = render(<RichContentRenderer html={fullHtml} />);

    fireEvent.click(screen.getByRole("button", { name: "دوم" }));
    expect(screen.getByRole("dialog", { name: "دوم" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<RichContentRenderer html={reducedHtml} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");

    rerender(<RichContentRenderer html={fullHtml} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});

// FE-CMS-TABLE-MEDIA-RENDER-001: parseContent() extracted a besat block
// (media/gallery/etc) found anywhere in the HTML the same way whether it
// was a genuine top-level block or nested inside a table cell -- splitting
// the table's markup into a "before" and "after" HTML fragment, each
// rendered in its own separate dangerouslySetInnerHTML node. An unclosed
// "<table><tr><td>" fragment and an orphaned "</td></tr>...</table>"
// fragment are each invalid on their own, so the browser's fragment parser
// silently dropped/mangled the surrounding rows and cells. A first attempt
// at this fix carved out only the inner <table>, but the backend always
// wraps a table in its own `<div class="besat-table-wrapper">` (see
// backend/apps/content/rich_text.py's _render_table) -- that wrapper's own
// opening/closing <div> tags were still being split apart, so this test
// uses that exact production shape, not a bare <table>.
describe("rich content table with a nested media block", () => {
  it("keeps every row/cell and the nested media image inside the table instead of splitting it apart", () => {
    render(
      <RichContentRenderer
        html={[
          '<div class="besat-table-wrapper"><table><tbody>',
          '<tr><td><figure data-besat-block="media" data-src="/media/a.jpg"><img src="/media/a.jpg" alt="" /></figure></td></tr>',
          "<tr><td><p>مقدار جدول</p></td></tr>",
          "</tbody></table></div>",
        ].join("")}
      />,
    );

    const table = screen.getByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("مقدار جدول")).toBeInTheDocument();
    expect(table.querySelector("img")).not.toBeNull();
  });

  it("does not stop at a nested div's own closing tag when finding the table wrapper's true end", () => {
    // A gallery item's own <div ...></div> sits inside the wrapper, before
    // the wrapper's real closing </div> -- a naive "stop at the first
    // </div>" scan would truncate the wrapper right there and drop the
    // second row entirely, the same class of bug this fix addresses.
    render(
      <RichContentRenderer
        html={[
          '<div class="besat-table-wrapper"><table><tbody>',
          '<tr><td><section data-besat-block="gallery" data-lightbox="false"><div data-besat-gallery-item data-src="/media/a.jpg" data-title="گالری"></div></section></td></tr>',
          "<tr><td><p>مقدار جدول</p></td></tr>",
          "</tbody></table></div>",
        ].join("")}
      />,
    );

    const table = screen.getByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("مقدار جدول")).toBeInTheDocument();
    expect(table.querySelector("[data-besat-gallery-item]")).not.toBeNull();
  });
});
