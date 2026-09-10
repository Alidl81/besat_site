import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock, detailDeferred } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentItem: vi.fn(),
    contentCategories: vi.fn(),
    contentRevisions: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
  },
  detailDeferred: {
    promise: null as Promise<unknown> | null,
    resolve: null as ((value: unknown) => void) | null,
  },
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({
    data: {
      results: [item],
      count: 1,
      next: null,
      previous: null,
      summary: { draft: 1, in_review: 0, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("@/components/editor/rich-editor", () => ({ RichEditor: () => <div data-testid="rich-editor" /> }));
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
vi.mock("@/components/editor/editor-document-outline", () => ({ EditorDocumentOutline: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/editor/block-inspector", () => ({ BlockInspector: () => null }));
vi.mock("@/components/editor/editor-icons", () => ({ EditorIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/crud/crud-ui", () => ({ StatusBadge: ({ status }: { status: string }) => <span>{status}</span> }));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p>{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));

const item = {
  id: "content-1",
  title: "عنوان قدیمی",
  summary: "خلاصه قدیمی",
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
  slug: "content-1",
  author: null,
  updated_at: "2026-08-30T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  detailDeferred.promise = null;
  detailDeferred.resolve = null;
});

// FE-CMS-EDITOR-DETAIL-HYDRATION-LOSS-001: the editor's fields stay
// interactive while the content-detail request (loadDetail()) is still in
// flight -- there's no loading gate on them. loadDetail() used to
// unconditionally call setDraft(draftFrom(loaded))/setDirty(false) once the
// response landed, silently discarding any edit the user made in the
// meantime. Fixed by reusing the same editVersion-ref call-time-captured
// guard persist() already uses on the save path: loadDetail() now only
// re-hydrates the draft from the response if no field edit happened since
// the request was issued.
describe("EditorialWorkspace detail hydration", () => {
  it("does not overwrite a title edited while the detail request is pending", async () => {
    detailDeferred.promise = new Promise((resolve) => { detailDeferred.resolve = resolve; });
    panelServiceMock.contentItem.mockReturnValue(detailDeferred.promise);
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);

    const { EditorialWorkspace } = await import("@/components/dashboard/editorial-workspace");
    render(<EditorialWorkspace authorRole="general_manager" />);

    fireEvent.click(screen.getAllByRole("button", { name: /ویرایش عنوان قدیمی/ })[0]);
    const title = await screen.findByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید");
    fireEvent.change(title, { target: { value: "ویرایش محلی کاربر" } });

    await act(async () => {
      detailDeferred.resolve?.({ ...item, title: "عنوان قدیمی از سرور" });
      await detailDeferred.promise;
    });

    await waitFor(() => expect(title).toHaveValue("ویرایش محلی کاربر"));
  });
});

// FE-CMS-EDITOR-DETAIL-ERROR-RECOVERY-001: a failed detail fetch left
// `currentItem`/`draft` at the incomplete list-summary `item` prop, with
// Save/workflow buttons still enabled and the status text eventually
// falling through to "autosave active" -- no signal that a save right now
// would submit stale/incomplete content, and no way to retry the failed
// fetch specifically (only the generic, next-action-cleared error banner).
describe("EditorialWorkspace detail error recovery", () => {
  it("disables save, shows a named retry, and re-enables save once retry succeeds", async () => {
    panelServiceMock.contentItem.mockRejectedValueOnce(new Error("دریافت اطلاعات با خطا مواجه شد"));
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);

    const { EditorialWorkspace } = await import("@/components/dashboard/editorial-workspace");
    render(<EditorialWorkspace authorRole="general_manager" />);

    fireEvent.click(screen.getAllByRole("button", { name: /ویرایش عنوان قدیمی/ })[0]);

    await screen.findByText("دریافت نسخه کامل این محتوا ناموفق بود. تا دریافت موفق، محتوای نمایش‌داده‌شده ممکن است ناقص باشد و ذخیره غیرفعال شده است.");
    // The generic errorText banner (set by applyFailure() on this same
    // failure) must also be visible -- this is the exact stale-alert
    // regression: it used to survive a later successful retry untouched.
    await screen.findByText("دریافت اطلاعات با خطا مواجه شد");
    const saveButton = screen.getByRole("button", { name: "ذخیره" });
    expect(saveButton).toBeDisabled();

    panelServiceMock.contentItem.mockResolvedValueOnce(item);
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(saveButton).not.toBeDisabled());
    expect(screen.queryByText("دریافت نسخه کامل این محتوا ناموفق بود. تا دریافت موفق، محتوای نمایش‌داده‌شده ممکن است ناقص باشد و ذخیره غیرفعال شده است.")).not.toBeInTheDocument();
    // FE-CMS-EDITOR-DETAIL-ERROR-STALE-ALERT-001: the earlier failure's
    // generic errorText banner must also clear once the retry succeeds,
    // not just the dedicated detailError alert.
    expect(screen.queryByText("دریافت اطلاعات با خطا مواجه شد")).not.toBeInTheDocument();
  });

  // FE-CMS-EDITOR-PREVIEW-STALE-DETAIL-001: the header Preview button (and
  // openPreview() itself) had no detailError/detailLoading guard, so
  // clicking it while the detail fetch had failed opened a preview dialog
  // and fired a second, premature detail request before the user had even
  // retried the first one.
  it("disables Preview while the detail fetch is failing, and does not fetch a preview if clicked anyway", async () => {
    panelServiceMock.contentItem.mockRejectedValueOnce(new Error("دریافت اطلاعات با خطا مواجه شد"));
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);

    const { EditorialWorkspace } = await import("@/components/dashboard/editorial-workspace");
    render(<EditorialWorkspace authorRole="general_manager" />);

    fireEvent.click(screen.getAllByRole("button", { name: /ویرایش عنوان قدیمی/ })[0]);
    await screen.findByText("دریافت نسخه کامل این محتوا ناموفق بود. تا دریافت موفق، محتوای نمایش‌داده‌شده ممکن است ناقص باشد و ذخیره غیرفعال شده است.");

    const previewButton = screen.getByRole("button", { name: "پیش‌نمایش" });
    expect(previewButton).toBeDisabled();

    const callsBeforeClick = panelServiceMock.contentItem.mock.calls.length;
    fireEvent.click(previewButton);
    expect(panelServiceMock.contentItem.mock.calls.length).toBe(callsBeforeClick);
  });
});
