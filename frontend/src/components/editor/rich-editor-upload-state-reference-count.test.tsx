import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichEditor } from "@/components/editor/rich-editor";

afterEach(() => cleanup());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: onUploadState used to be called
// true/false directly around each of uploadAndInsert's and the
// replace-image handler's own, independent upload call sites. Two
// overlapping uploads -- here, a toolbar-triggered upload and a
// replace-image upload started while the first is still pending --
// previously meant the FIRST one to settle reported `false` to the parent
// (editorial-workspace.tsx's save-blocking guard, among any future
// consumer) while the second upload was still in flight. Reference
// counting in RichEditor now only reports `false` once every concurrent
// upload it started has actually settled.
describe("RichEditor onUploadState reference counting", () => {
  it("does not report upload completion while a second, unrelated upload is still pending", async () => {
    const first = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    const second = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    let callCount = 0;
    const onUploadMedia = vi.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? first.promise : second.promise;
    });
    const onUploadState = vi.fn();

    const { container } = render(
      <RichEditor
        value=""
        jsonValue={{
          type: "doc",
          content: [{ type: "image", attrs: { src: "/media/old.jpg", alt: "قدیمی" } }],
        }}
        onChange={() => undefined}
        onUploadMedia={onUploadMedia}
        onUploadState={onUploadState}
      />,
    );

    await waitFor(() => expect(container.querySelector(".besat-editor-canvas")).toBeInTheDocument(), { timeout: 30000 });

    const toolbarInput = container.querySelector('input[type="file"][accept*="video/mp4"]');
    const replaceInput = container.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp,image/gif,image/avif"]');
    expect(toolbarInput).not.toBeNull();
    expect(replaceInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(toolbarInput!, { target: { files: [new File(["one"], "one.jpg", { type: "image/jpeg" })] } });
      await Promise.resolve();
    });
    await waitFor(() => expect(onUploadState).toHaveBeenCalledWith(true));

    await act(async () => {
      fireEvent.change(replaceInput!, { target: { files: [new File(["two"], "two.jpg", { type: "image/jpeg" })] } });
      await Promise.resolve();
    });
    expect(onUploadMedia).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve({ url: "/media/one.jpg", media_type: "image", alt_text: "one", caption: "" });
      await first.promise;
    });
    // The mount-time effect run announces `false` once up front (count
    // starts at 0); what matters here is the state *after* the first
    // upload settles while the second is still pending, which must still
    // read busy.
    expect(onUploadState).toHaveBeenLastCalledWith(true);

    await act(async () => {
      second.resolve({ url: "/media/two.jpg", media_type: "image", alt_text: "two", caption: "" });
      await second.promise;
    });
    await waitFor(() => expect(onUploadState).toHaveBeenLastCalledWith(false));
  });
});
