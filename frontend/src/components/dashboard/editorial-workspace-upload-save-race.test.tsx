import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CapturedRichEditorProps = {
  onUploadState: (active: boolean) => void;
  onUploadMedia: (
    file: File,
  ) => Promise<{ url: string; media_type: "image"; alt_text: string; caption: string }>;
};

const { panelServiceMock, richEditorProps } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentCategories: vi.fn(),
    contentRevisions: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
    uploadMedia: vi.fn(),
  },
  richEditorProps: { current: null as CapturedRichEditorProps | null },
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({
    data: {
      results: [], count: 0, next: null, previous: null,
      summary: { draft: 0, in_review: 0, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("@/components/editor/rich-editor", () => ({
  RichEditor: (props: CapturedRichEditorProps) => {
    richEditorProps.current = props;
    return <div data-testid="rich-editor" />;
  },
}));
vi.mock("@/components/cms/content-block-inserter", () => ({ ContentBlockInserter: () => null }));
vi.mock("@/components/cms/seo-panel", () => ({
  emptySeoDraft: {
    focusKeyphrase: "", seoTitle: "", metaDescription: "", canonicalUrl: "",
    ogTitle: "", ogDescription: "", ogImageUrl: "", isIndexable: true,
    isFollowable: true, isCornerstone: false,
  },
  SeoPanel: () => null,
  seoDraftFrom: (value: unknown) => value,
  seoDraftToPayload: () => ({}),
}));
vi.mock("@/components/content/rich-content-renderer", () => ({ RichContentRenderer: () => null }));
vi.mock("@/components/editor/editor-document-outline", () => ({
  EditorDocumentOutline: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/editor/block-inspector", () => ({ BlockInspector: () => null }));
vi.mock("@/components/editor/editor-icons", () => ({ EditorIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/crud/crud-ui", () => ({ StatusBadge: ({ status }: { status: string }) => <span>{status}</span> }));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p>{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));

import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";

const created = {
  id: "content-upload-race",
  title: "عنوان بارگذاری",
  summary: null,
  body_html: "",
  body_json: null,
  cover_image_url: null,
  category: null,
  kind: "news",
  scope: "school",
  unit: null,
  scheduled_at: null,
  scheduled_unpublish_at: null,
  seo: null,
  audience: "all",
  is_featured: false,
  is_important: false,
  status: "draft",
  version: 1,
  slug: "content-upload-race",
  author: null,
  updated_at: "2026-09-01T00:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  richEditorProps.current = null;
  panelServiceMock.content.mockResolvedValue({ results: [], count: 0, next: null, previous: null, summary: null });
  panelServiceMock.contentCategories.mockResolvedValue([]);
  panelServiceMock.contentRevisions.mockResolvedValue([]);
  panelServiceMock.createContent.mockResolvedValue(created);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: save()/workflow()/openPreview() now
// gate on pendingUploadCountRef, a plain counter incremented/decremented
// only by work editorial-workspace.tsx itself awaits (uploadEditorMedia's
// try/finally, and ContentBlockInserter's onUploadState, both of which are
// always correctly paired) -- not on the cosmetic `uploading` state, which
// still mirrors RichEditor's onUploadState callback as before and is
// allowed to go stale/report a premature `false` (see the second test
// below, which asserts the save *button* is visually enabled again after
// exactly that premature signal, while the real save is still blocked).
describe("EditorialWorkspace save while RichEditor upload is pending", () => {
  it("must not persist a draft before an in-flight media upload has inserted its result", async () => {
    const upload = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    panelServiceMock.uploadMedia.mockReturnValue(upload.promise);

    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));
    fireEvent.change(screen.getByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید"), {
      target: { value: "عنوان بارگذاری" },
    });

    await waitFor(() => expect(richEditorProps.current).not.toBeNull());
    await act(async () => {
      richEditorProps.current!.onUploadState(true);
      void richEditorProps.current!.onUploadMedia(new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    });

    const form = screen.getByRole("button", { name: /ذخیره/ }).closest("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form!);
    });

    await waitFor(() => expect(panelServiceMock.createContent).not.toHaveBeenCalled());

    await act(async () => {
      upload.resolve({ url: "/media/photo.jpg", media_type: "image", alt_text: "photo", caption: "" });
      await upload.promise;
    });
  });

  it("must keep the save barrier active until every concurrent upload settles", async () => {
    const first = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    const second = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    let uploadIndex = 0;
    panelServiceMock.uploadMedia.mockImplementation(() => {
      uploadIndex += 1;
      return uploadIndex === 1 ? first.promise : second.promise;
    });

    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));
    fireEvent.change(screen.getByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید"), {
      target: { value: "عنوان دو بارگذاری" },
    });

    await waitFor(() => expect(richEditorProps.current).not.toBeNull());
    await act(async () => {
      // This is the exact callback contract RichEditor currently uses for a
      // deliberate two-file drop/paste: each upload announces start and
      // completion independently, but the parent receives only a boolean.
      richEditorProps.current!.onUploadState(true);
      void richEditorProps.current!.onUploadMedia(new File(["one"], "one.jpg", { type: "image/jpeg" }));
      richEditorProps.current!.onUploadState(true);
      void richEditorProps.current!.onUploadMedia(new File(["two"], "two.jpg", { type: "image/jpeg" }));
      richEditorProps.current!.onUploadState(false);
    });

    const saveButton = screen.getByRole("button", { name: /ذخیره/ });
    expect(saveButton).not.toBeDisabled();
    const form = saveButton.closest("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form!);
    });
    await waitFor(() => expect(panelServiceMock.createContent).not.toHaveBeenCalled());

    await act(async () => {
      first.resolve({ url: "/media/one.jpg", media_type: "image", alt_text: "one", caption: "" });
      second.resolve({ url: "/media/two.jpg", media_type: "image", alt_text: "two", caption: "" });
      await Promise.all([first.promise, second.promise]);
    });
  });
});

// FE-CMS-COVER-PREVIEW-UPLOAD-RACE-001: uploadCover() never reported into
// pendingUploadCountRef -- only uploadEditorMedia()/ContentBlockInserter did.
// With a cover upload and an unrelated editor-media upload both pending, the
// editor-media upload settling alone (correctly returning the ref to 0)
// let Preview believe nothing was pending anymore, even though the cover
// upload -- and its eventual coverImageUrl -- was still genuinely in
// flight.
describe("EditorialWorkspace preview while a cover upload is pending", () => {
  it("keeps Preview disabled while a cover upload is still in flight, even after an unrelated editor-media upload settles", async () => {
    const editorUpload = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    const coverUpload = deferred<{ url: string; media_type: "image"; alt_text: string; caption: string }>();
    let uploadIndex = 0;
    panelServiceMock.uploadMedia.mockImplementation(() => {
      uploadIndex += 1;
      return uploadIndex === 1 ? editorUpload.promise : coverUpload.promise;
    });

    const { container } = render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));
    fireEvent.change(screen.getByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید"), {
      target: { value: "عنوان رقابت جلد" },
    });

    await waitFor(() => expect(richEditorProps.current).not.toBeNull());
    await act(async () => {
      richEditorProps.current!.onUploadState(true);
      void richEditorProps.current!.onUploadMedia(new File(["editor"], "editor.jpg", { type: "image/jpeg" }));
    });

    const coverInput = container.querySelector('input[type="file"]');
    expect(coverInput).not.toBeNull();
    await act(async () => {
      fireEvent.change(coverInput!, { target: { files: [new File(["cover"], "cover.jpg", { type: "image/jpeg" })] } });
    });

    // The unrelated editor-media upload settles first; the cover upload is
    // still genuinely pending.
    await act(async () => {
      richEditorProps.current!.onUploadState(false);
      editorUpload.resolve({ url: "/media/editor.jpg", media_type: "image", alt_text: "editor", caption: "" });
      await editorUpload.promise;
    });

    const previewButton = screen.getByRole("button", { name: "پیش‌نمایش" });
    expect(previewButton).toBeDisabled();
    const callsBeforeClick = panelServiceMock.uploadMedia.mock.calls.length;
    fireEvent.click(previewButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panelServiceMock.uploadMedia.mock.calls.length).toBe(callsBeforeClick);

    await act(async () => {
      coverUpload.resolve({ url: "/media/cover.jpg", media_type: "image", alt_text: "cover", caption: "" });
      await coverUpload.promise;
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "پیش‌نمایش" })).not.toBeDisabled());
  });
});
