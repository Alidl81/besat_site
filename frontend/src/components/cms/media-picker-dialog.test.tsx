import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMediaMock, mediaAssetsMock } = vi.hoisted(() => ({
  uploadMediaMock: vi.fn(),
  mediaAssetsMock: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: {
    uploadMedia: uploadMediaMock,
    mediaAssets: mediaAssetsMock,
  },
}));

vi.mock("@/components/editor/editor-icons", () => ({
  EditorIcon: () => <span aria-hidden="true" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mediaAssetsMock.mockResolvedValue({ results: [] });
});

afterEach(() => cleanup());

// FE-CMS-MEDIA-PICKER-UPLOAD-DOUBLE-SUBMIT-001: MediaPickerDialog's
// `isUploading` state is updated only after React commits. Two same-turn file
// changes (or a drag/drop plus file-picker activation) therefore both entered
// handleFile before the disabled button could render, creating duplicate CMS
// media records and storage writes for one user action.
describe("MediaPickerDialog upload re-entrancy", () => {
  it("collapses two same-turn file selections of the same file to one upload", async () => {
    const pending = new Promise<{ url: string; title: string; media_type: "image"; alt_text: string; caption: string }>(() => undefined);
    uploadMediaMock.mockReturnValue(pending);

    const { MediaPickerDialog } = await import("@/components/cms/media-picker-dialog");
    render(
      <MediaPickerDialog
        open
        value=""
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["bytes"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(input!, { target: { files: [file] } });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(uploadMediaMock).toHaveBeenCalledTimes(1);
  });
});

// SEC-FE-MEDIA-PICKER-URL-001: isSafeMediaUrl() only rejected a literal
// "//" leading pair, but WHATWG URL parsing treats "/" and "\"
// interchangeably as path separators for special schemes -- so a
// backslash-relative URL like "/\evil.example/pixel.jpg" also resolves
// off-origin in a real browser (verified: `new URL("/\\evil.example/pixel
// .jpg", "https://besat.org").origin` is `https://evil.example`), but
// used to pass the check, preview as an <img src>, and be forwarded to
// onSelect() unchanged.
describe("MediaPickerDialog direct URL safety", () => {
  it("rejects a backslash-relative URL instead of previewing/selecting it as same-origin", async () => {
    const onSelect = vi.fn();
    const { MediaPickerDialog } = await import("@/components/cms/media-picker-dialog");
    render(<MediaPickerDialog open value="" onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "لینک" }));
    const input = screen.getByLabelText("لینک عکس یا ویدیو");
    const unsafe = "/\\evil.example/pixel.jpg";
    fireEvent.change(input, { target: { value: unsafe } });

    expect(screen.queryByRole("img", { name: "پیش‌نمایش مدیا" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "انتخاب مدیا" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("نشانی رسانه معتبر نیست.")).toBeInTheDocument();
  });

  // SEC-FE-MEDIA-PICKER-URL-001 (reopened): the single-vector fix above
  // only checked for a literal "\" character, missing three more ways a
  // string can normalize into an off-origin request: a literal newline
  // (which the WHATWG parser strips, collapsing "/\n/evil.example" into
  // "//evil.example"), and two absolute-URL forms using a backslash in
  // place of "//" after the scheme ("http:\\evil.example",
  // "http:/\/evil.example"), both of which the old check's "protocol is
  // http(s)" test accepted without noticing the host was attacker-
  // controlled. isSafeMediaUrl() now delegates entirely to the shared,
  // already-hardened @/lib/url-safety helpers (isSafeExternalHttpUrl,
  // isSafeRelativePath) instead of a component-local check, closing this
  // as a shared-utility fix rather than a third patch to this file alone.
  it.each([
    ["/\n/evil.example/newline.jpg", "newline-normalized"],
    ["http:\\\\evil.example/backslash.jpg", "absolute-backslash"],
    ["http:/\\/evil.example/mixed-separators.jpg", "mixed-separators"],
  ])("rejects %s instead of previewing/selecting it as safe (%s)", async (unsafe) => {
    const onSelect = vi.fn();
    const { MediaPickerDialog } = await import("@/components/cms/media-picker-dialog");
    render(<MediaPickerDialog open value={unsafe} onSelect={onSelect} onClose={vi.fn()} />);

    expect(screen.queryByRole("img", { name: "پیش‌نمایش مدیا" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "انتخاب مدیا" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
