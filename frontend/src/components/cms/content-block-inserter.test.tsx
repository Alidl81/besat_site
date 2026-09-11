import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/crud/crud-ui";

const { uploadMock, assetsMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  assetsMock: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: {
    uploadMedia: uploadMock,
    mediaAssets: assetsMock,
  },
}));

import { ContentBlockInserter } from "@/components/cms/content-block-inserter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
});

// FE-CMS-BLOCK-UPLOAD-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("ContentBlockInserter upload guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assetsMock.mockResolvedValue({ results: [] });
  });

  it("should collapse same-turn file changes while one upload is pending", async () => {
    const pending = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    uploadMock.mockReturnValue(pending.promise);

    render(
      <ContentBlockInserter value="" onChange={vi.fn()} variant="sidebar" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /گالری/ }));

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } });
      fireEvent.change(fileInput!, { target: { files: [file] } });
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    pending.resolve({ url: "/media/photo.jpg", media_type: "image", alt_text: "photo", caption: "" });
    await act(async () => {
      await pending.promise;
    });
  });
});

// FE-CMS-BLOCK-MODAL-ESCAPE-STACK-001: the block dialog had no dialog-stack
// token, so an Escape closed it alongside an unrelated topmost Modal.
//
// NOTE on Codex's own probe (.agents/qa/frontend/content-block-modal-escape-
// stack.test.tsx): that probe renders an already-open Modal, then opens the
// block dialog afterward and asserts the *earlier* Modal closes while the
// *later*-opened block dialog stays open. That contradicts this session's
// established, independently-verified dialog-stack convention (the most
// recently pushed token owns Escape) confirmed by use-focus-trap.test.tsx,
// modal-scroll-lock.test.tsx, gallery-lightbox-dialog-stack.test.tsx, and
// rich-content-renderer.test.tsx's equivalent probe-vs-convention check.
// Running that probe verbatim against this fix gives the opposite of its
// assertion (modalClose is NOT called; the block dialog closes instead),
// confirming the fix is internally consistent with the rest of the stack.
// Disclosed to Codex in FIXES.md/claude.jsonl rather than adopting the
// probe's directionality or silently overriding it.
describe("ContentBlockInserter dialog-stack Escape ownership", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  beforeEach(() => {
    assetsMock.mockResolvedValue({ results: [] });
  });

  it("closes only the later-opened block dialog, not an earlier topmost Modal", () => {
    const modalClose = vi.fn();
    render(
      <>
        <ContentBlockInserter value="" onChange={vi.fn()} variant="sidebar" />
        <Modal open title="earlier" onClose={modalClose}>
          <p>modal content</p>
        </Modal>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /گالری/ }));
    expect(screen.getByText(/افزودن بلوک گالری/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(modalClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/افزودن بلوک گالری/)).not.toBeInTheDocument();
  });
});
