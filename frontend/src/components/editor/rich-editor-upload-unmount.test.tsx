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

// FE-CMS-EDITOR-UPLOAD-UNMOUNT-001: uploadAndInsert() (toolbar upload), the
// replace-image handler, and the gallery node view's addFiles() all await a
// real upload and then call back into the TipTap editor (.chain()/
// editor.view.dispatch()) once it resolves. If the whole RichEditor (and
// its editor instance) is unmounted while that upload is still pending --
// the CMS panel closed, navigated away, etc. -- the editor is destroyed by
// the time the upload settles, and touching it threw an uncaught
// "Cannot read properties of null (reading 'chain')" instead of the upload
// becoming a safe no-op.
describe("RichEditor upload survives (does not throw after) unmount", () => {
  it("does not throw when a toolbar upload resolves after the editor unmounts", async () => {
    const upload = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    const onUploadMedia = vi.fn().mockReturnValue(upload.promise);
    // uploadAndInsert() is an internal async function this test can't
    // await directly (it's invoked fire-and-forget from a DOM event
    // handler) -- an uncaught exception inside it after the awaited
    // upload surfaces as a Node-level "unhandledRejection" process event,
    // not a jsdom window event, since Vitest's test process itself is the
    // realm that actually runs the promise microtask queue. Listening
    // here catches the exact regression deterministically instead of
    // relying on Vitest's own end-of-run unhandled-error reporting, which
    // does not fail the individual test.
    const rejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    const { container, unmount } = render(
      <RichEditor
        value=""
        jsonValue={{ type: "doc", content: [{ type: "paragraph" }] }}
        onChange={() => undefined}
        onUploadMedia={onUploadMedia}
      />,
    );

    await waitFor(() => expect(container.querySelector(".besat-editor-canvas")).toBeInTheDocument(), { timeout: 30000 });

    const toolbarInput = container.querySelector('input[type="file"][accept*="video/mp4"]');
    expect(toolbarInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(toolbarInput!, { target: { files: [new File(["one"], "one.jpg", { type: "image/jpeg" })] } });
      await Promise.resolve();
    });
    expect(onUploadMedia).toHaveBeenCalledTimes(1);

    unmount();

    // TipTap's own useEditor cleanup defers the actual editor.destroy()
    // call to a real setTimeout(0) ("scheduleDestroy" -- deliberately not
    // synchronous, so a fast unmount/remount in React StrictMode doesn't
    // destroy an editor that's actually still mounted a tick later). A
    // microtask flush alone does not let that timer fire; this needs a
    // real macrotask tick before the editor is genuinely destroyed, which
    // is the exact state the reported bug reproduces against.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await act(async () => {
      upload.resolve({ url: "/media/one.jpg", media_type: "image", alt_text: "one", caption: "" });
      await upload.promise;
      // Let the resumed async continuation (the code after the awaited
      // upload) actually run before asserting nothing threw.
      await Promise.resolve();
      await Promise.resolve();
    });

    process.off("unhandledRejection", onUnhandledRejection);
    expect(rejections).toEqual([]);
  });
});
