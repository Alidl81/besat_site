import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichEditor } from "@/components/editor/rich-editor";

afterEach(() => cleanup());

// FE-CMS-RICH-EDITOR-UPLOAD-DOUBLE-SUBMIT-001: uploadAndInsert() only
// reported busy state via onUploadState (a callback into the parent, not
// something read synchronously here), and the separate replacement-image
// handler had the same shape -- so two same-tick file selections on
// either input both started an upload. Fixed with per-channel refs
// (toolbarUploadingRef, replaceUploadingRef) rather than a guard inside
// uploadAndInsert itself, since that function is also called once per
// file for a legitimate multi-file drag/drop or paste batch, which must
// stay concurrent.
describe("RichEditor media upload re-entry", () => {
  it("collapses two same-turn toolbar file selections to one upload", async () => {
    const onUploadMedia = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { container } = render(
      <RichEditor
        value="<p>متن</p>"
        onChange={() => undefined}
        onUploadMedia={onUploadMedia}
      />,
    );

    await waitFor(() => expect(container.querySelector(".besat-editor-canvas")).toBeInTheDocument(), { timeout: 30000 });
    const input = container.querySelector('input[type="file"][accept*="video/mp4"]');
    expect(input).not.toBeNull();
    const first = new File(["one"], "one.jpg", { type: "image/jpeg" });
    const second = new File(["two"], "two.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input!, { target: { files: [first] } });
      fireEvent.change(input!, { target: { files: [second] } });
      await Promise.resolve();
    });

    expect(onUploadMedia).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-turn replacement selections to one upload", async () => {
    const onUploadMedia = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { container } = render(
      <RichEditor
        value=""
        jsonValue={{
          type: "doc",
          content: [{ type: "image", attrs: { src: "/media/old.jpg", alt: "قدیمی" } }],
        }}
        onChange={() => undefined}
        onUploadMedia={onUploadMedia}
      />,
    );

    await waitFor(() => expect(container.querySelector(".besat-editor-canvas")).toBeInTheDocument(), { timeout: 30000 });
    const input = container.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp,image/gif,image/avif"]');
    expect(input).not.toBeNull();
    const first = new File(["one"], "one.jpg", { type: "image/jpeg" });
    const second = new File(["two"], "two.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input!, { target: { files: [first] } });
      fireEvent.change(input!, { target: { files: [second] } });
      await Promise.resolve();
    });

    expect(onUploadMedia).toHaveBeenCalledTimes(1);
  });
});
