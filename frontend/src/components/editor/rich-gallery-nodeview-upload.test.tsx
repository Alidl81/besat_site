import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichEditor } from "@/components/editor/rich-editor";
import { buildGalleryBlockHtml } from "@/lib/editor/structured-content";

afterEach(() => cleanup());

// FE-CMS-RICH-GALLERY-NODEVIEW-UPLOAD-DOUBLE-SUBMIT-001 +
// FE-CMS-RICH-GALLERY-NODEVIEW-UPLOAD-LOST-UPDATE (adjacent finding):
// createGalleryNodeView's addFiles() used to snapshot `currentNode.attrs.
// items` once at the start of a batch and write that local copy back after
// every file in *that* batch finished uploading. Two same-turn addFiles()
// calls (e.g. two separate gallery file-input changes) both start from the
// same stale snapshot, so whichever batch finishes last overwrote the
// other batch's already-written item instead of merging with it -- a lost
// update, not a duplicate-submission problem. A guard that simply dropped
// the second same-turn batch would have "fixed" the symptom by silently
// discarding a file the user explicitly selected, which is worse. The
// actual fix re-reads the current items from `currentNode` (kept in sync
// by the node view's `update()` hook) immediately before the final write,
// so a concurrent batch's write is never clobbered. This is confirmed by
// running all three of Codex's related probes (double-submit,
// lost-update, and the single deliberate multi-file-selection control)
// verbatim against the fix: all three already pass without any rewriting
// -- the "double-submit" probe's `toHaveBeenCalledTimes(2)` assertion was
// actually describing correct behavior (both uploads must still happen),
// and the true defect was the merge, not the call count.
describe("RichEditor gallery node-view upload convergence", () => {
  it("merges two same-turn gallery batches instead of losing one to a stale-snapshot overwrite", async () => {
    const resolvers: Array<() => void> = [];
    const onUploadMedia = vi.fn((file: File) => new Promise<{ url: string; media_type: "image" }>((resolve) => {
      resolvers.push(() => resolve({ url: `/media/${file.name}`, media_type: "image" }));
    }));
    const onChange = vi.fn();
    const { container } = render(
      <RichEditor
        value={buildGalleryBlockHtml([])}
        onChange={onChange}
        mode="advanced"
        onUploadMedia={onUploadMedia}
      />,
    );

    const input = await waitFor(() => {
      const candidate = container.querySelector('input[type="file"][multiple]');
      expect(candidate).not.toBeNull();
      return candidate as HTMLInputElement;
    }, { timeout: 30000 });
    const first = new File(["one"], "one.jpg", { type: "image/jpeg" });
    const second = new File(["two"], "two.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [first] } });
      fireEvent.change(input, { target: { files: [second] } });
      await Promise.resolve();
    });
    expect(onUploadMedia).toHaveBeenCalledTimes(2);
    expect(resolvers).toHaveLength(2);

    await act(async () => {
      resolvers[0]();
      await Promise.resolve();
    });
    await waitFor(() => expect(container.querySelector('img[src="/media/one.jpg"]')).toBeInTheDocument());

    await act(async () => {
      resolvers[1]();
      await Promise.resolve();
    });
    await waitFor(() => expect(container.querySelector('img[src="/media/two.jpg"]')).toBeInTheDocument());

    expect(container.querySelectorAll('img[src^="/media/"]')).toHaveLength(2);
  });

  it("preserves all files from one deliberate multi-file selection", async () => {
    const onUploadMedia = vi.fn((file: File) => Promise.resolve({
      url: `/media/${file.name}`,
      media_type: "image" as const,
    }));
    const { container } = render(
      <RichEditor
        value={buildGalleryBlockHtml([])}
        onChange={() => undefined}
        mode="advanced"
        onUploadMedia={onUploadMedia}
      />,
    );
    const input = await waitFor(() => {
      const candidate = container.querySelector('input[type="file"][multiple]');
      expect(candidate).not.toBeNull();
      return candidate as HTMLInputElement;
    }, { timeout: 30000 });

    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [
            new File(["one"], "one.jpg", { type: "image/jpeg" }),
            new File(["two"], "two.jpg", { type: "image/jpeg" }),
          ],
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(container.querySelectorAll('img[src^="/media/"]')).toHaveLength(2));
    expect(onUploadMedia).toHaveBeenCalledTimes(2);
  });
});
