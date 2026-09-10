import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock, requestImpl } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentCategories: vi.fn(),
    contentItem: vi.fn(),
    contentRevisions: vi.fn(),
    restoreContentRevision: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
    contentAction: vi.fn(),
    contentPreview: vi.fn(),
    contentRevisionComparison: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => requestImpl(),
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
vi.mock("@/components/editor/editor-document-outline", () => ({
  EditorDocumentOutline: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/editor/block-inspector", () => ({ BlockInspector: () => null }));
vi.mock("@/components/editor/editor-icons", () => ({ EditorIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/crud/crud-ui", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p>{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));

import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";

const draftItem = {
  id: "news-9",
  title: "خبر نمونه",
  summary: null,
  body_html: "<p>متن فعلی</p>",
  body_json: null,
  cover_image_url: null,
  category: null,
  kind: "news" as const,
  scope: "school" as const,
  unit: null,
  scheduled_at: null,
  scheduled_unpublish_at: null,
  seo: null,
  audience: "all" as const,
  is_featured: false,
  is_important: false,
  status: "draft" as const,
  version: 4,
  slug: "sample-news",
  author: null,
  updated_at: "2026-08-30T00:00:00Z",
  published_at: null,
  created_at: "2026-08-29T00:00:00Z",
};

const revision = {
  id: 17,
  created_at: "2026-08-29T00:00:00Z",
  note: "نسخه قبلی",
  actor: { full_name: "سردبیر" },
  snapshot: {
    ...draftItem,
    body_html: "<p>نسخه قبلی</p>",
    status: "draft",
    version: 3,
  },
};

const publishedItem = { ...draftItem, status: "published" as const, published_at: "2026-08-30", summary: "خلاصه" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// FE-CMS-EDITOR-RESTORE-DOUBLE-SUBMIT-001: restoreRevision() did not use
// the synchronous savingRef guard already shared by save()/workflow()/
// uploadCover(), so two same-tick confirmed restore clicks both reached
// restoreContentRevision.
describe("EditorialWorkspace revision restore duplicate boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestImpl.mockReturnValue({
      data: {
        results: [draftItem],
        count: 1,
        next: null,
        previous: null,
        summary: { draft: 1, in_review: 0, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentItem.mockResolvedValue(draftItem);
    panelServiceMock.contentRevisions.mockResolvedValue([revision]);
    panelServiceMock.restoreContentRevision.mockImplementation(() => new Promise(() => undefined));
  });

  it("collapses two same-turn confirmed restore clicks to one mutation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: "ویرایش" }));

    const restore = await screen.findByRole("button", { name: "بازگردانی نسخه" });
    await waitFor(() => expect(panelServiceMock.contentRevisions).toHaveBeenCalledWith("news-9"));

    await act(async () => {
      fireEvent.click(restore);
      fireEvent.click(restore);
      await Promise.resolve();
    });

    expect(panelServiceMock.restoreContentRevision).toHaveBeenCalledTimes(1);
  });
});

// FE-CMS-EDITOR-BULK-ARCHIVE-DOUBLE-SUBMIT-001: moveSelected()'s bulk
// action guarded only with state-backed `bulkPending`, so two same-tick
// clicks on the same bulk action both started the batch.
describe("EditorialWorkspace bulk archive duplicate boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestImpl.mockReturnValue({
      data: {
        results: [publishedItem],
        count: 1,
        next: null,
        previous: null,
        summary: { draft: 0, in_review: 0, changes_requested: 0, approved: 0, published: 1, scheduled: 0, archived: 0 },
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentAction.mockImplementation(() => new Promise(() => undefined));
  });

  it("collapses two same-turn bulk archive clicks to one mutation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EditorialWorkspace authorRole="general_manager" />);
    const checkboxes = await screen.findAllByRole("checkbox", { name: "انتخاب خبر نمونه" });
    fireEvent.click(checkboxes[0]);
    const archive = await screen.findByRole("button", { name: "آرشیو گروهی" });

    await act(async () => {
      fireEvent.click(archive);
      fireEvent.click(archive);
      await Promise.resolve();
    });

    expect(panelServiceMock.contentAction).toHaveBeenCalledTimes(1);
    expect(panelServiceMock.contentAction).toHaveBeenNthCalledWith(1, "news-9", "archive", {}, 4);
  });
});
