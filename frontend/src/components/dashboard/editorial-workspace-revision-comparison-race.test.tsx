import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock, requestImpl } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentCategories: vi.fn(),
    contentItem: vi.fn(),
    contentRevisions: vi.fn(),
    contentRevisionComparison: vi.fn(),
    contentPreview: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
    contentAction: vi.fn(),
    restoreContentRevision: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({ usePanelRequest: () => requestImpl() }));
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
vi.mock("@/components/crud/crud-ui", () => ({ StatusBadge: ({ status }: { status: string }) => <span>{status}</span> }));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p>{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));

import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";

const item = {
  id: "news-compare-1",
  title: "خبر فعلی",
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
  version: 5,
  slug: "news-compare-1",
  author: null,
  updated_at: "2026-08-30T00:00:00Z",
  published_at: null,
  created_at: "2026-08-29T00:00:00Z",
};

const revisionA = {
  id: 101,
  created_at: "2026-08-28T00:00:00Z",
  updated_at: "2026-08-28T00:00:00Z",
  note: "نسخه A",
  actor: null,
  snapshot: {
    ...item,
    title: "نسخه A",
    body_html: "<p>بدنه A</p>",
    status: "draft" as const,
    version: 4,
  },
};

const revisionB = {
  id: 202,
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
  note: "نسخه B",
  actor: null,
  snapshot: {
    ...item,
    title: "نسخه B",
    body_html: "<p>بدنه B</p>",
    status: "draft" as const,
    version: 5,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function comparison(revisionId: number, from: string, to: string) {
  return {
    base: { id: null, created_at: "2026-08-30T00:00:00Z", current: true as const },
    target: { id: revisionId, created_at: "2026-08-29T00:00:00Z" },
    changes: { title: { from, to } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requestImpl.mockReturnValue({
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
  });
  panelServiceMock.contentCategories.mockResolvedValue([]);
  panelServiceMock.contentItem.mockResolvedValue(item);
  panelServiceMock.contentRevisions.mockResolvedValue([revisionA, revisionB]);
  panelServiceMock.contentPreview.mockResolvedValue(item);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// FE-CMS-EDITOR-REVISION-COMPARISON-RACE-001: openRevisionComparison() set
// revisionComparison unconditionally once its request resolved, with no
// fence against a newer comparison (or a close/switch-to-preview) having
// since superseded it -- comparing revision A, closing, then comparing
// revision B, could have B's diff silently replaced by A's once A's
// slower response finally landed. revisionComparisonSeqRef (a monotonic
// counter bumped by every action that changes what's currently being
// viewed: a new comparison request, closing the dialog, or switching to
// the local/server preview) now lets a superseded response recognize
// itself and discard its own result.
describe("EditorialWorkspace revision comparison request identity", () => {
  it("does not let an older comparison overwrite a later revision after close-and-reopen", async () => {
    const first = deferred<ReturnType<typeof comparison>>();
    const second = deferred<ReturnType<typeof comparison>>();
    panelServiceMock.contentRevisionComparison.mockImplementation((_contentId: string, revisionId: number) => {
      return revisionId === revisionA.id ? first.promise : second.promise;
    });

    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: "ویرایش" }));
    await waitFor(() => expect(panelServiceMock.contentRevisions).toHaveBeenCalledWith(item.id));

    const compareButtons = await screen.findAllByRole("button", { name: "مقایسه نسخه" });
    fireEvent.click(compareButtons[0]);
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "بستن پیش‌نمایش" }));
    fireEvent.click(screen.getAllByRole("button", { name: "مقایسه نسخه" })[1]);
    await screen.findByRole("dialog");

    await act(async () => {
      second.resolve(comparison(revisionB.id, "B-before", "B-after"));
      await second.promise;
    });
    expect(screen.getByText("B-after")).toBeInTheDocument();

    await act(async () => {
      first.resolve(comparison(revisionA.id, "A-before", "A-after"));
      await first.promise;
    });

    expect(screen.getByText("B-after")).toBeInTheDocument();
    expect(screen.queryByText("A-after")).not.toBeInTheDocument();
  });
});
