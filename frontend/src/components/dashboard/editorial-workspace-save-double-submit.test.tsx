import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentCategories: vi.fn(),
    contentRevisions: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
    uploadMedia: vi.fn(),
  },
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({
    data: {
      results: [],
      count: 0,
      next: null,
      previous: null,
      summary: { draft: 0, in_review: 0, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("@/components/editor/rich-editor", () => ({
  RichEditor: () => <div data-testid="rich-editor" />,
}));
vi.mock("@/components/cms/content-block-inserter", () => ({
  ContentBlockInserter: () => null,
}));
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
vi.mock("@/components/editor/editor-icons", () => ({
  EditorIcon: () => <span aria-hidden="true" />,
}));
vi.mock("@/components/dashboard/panel-icons", () => ({
  PanelIcon: () => <span aria-hidden="true" />,
}));
vi.mock("@/components/crud/crud-ui", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p>{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));

import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";

const saved = {
  id: "content-1",
  title: "عنوان آزمایشی",
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
  slug: "content-1",
  author: null,
  updated_at: "2026-08-30T00:00:00Z",
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// FE-CMS-EDITOR-SAVE-DOUBLE-SUBMIT-001: save()'s only guard was
// state-backed `saving`, so two same-tick save submissions both entered
// the serial save queue -- the first created the record, and the second
// (queued behind it) then ran as an unwanted update against the
// newly-created item. A synchronous ref guard on save() (and the sibling
// workflow() handler) now collapses the second same-tick call instead of
// letting it queue.
describe("EditorialWorkspace save re-entrancy", () => {
  beforeEach(() => {
    panelServiceMock.content.mockResolvedValue({ results: [], count: 0, next: null, previous: null, summary: null });
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);
    panelServiceMock.createContent.mockResolvedValue(saved);
    panelServiceMock.updateContent.mockResolvedValue({ ...saved, version: 2 });
  });

  it("should send one create mutation for two same-turn save submissions", async () => {
    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));
    fireEvent.change(screen.getByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید"), {
      target: { value: "عنوان آزمایشی" },
    });

    const form = screen.getByRole("button", { name: /ذخیره/ }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(panelServiceMock.createContent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panelServiceMock.updateContent).not.toHaveBeenCalled());
  });
});

// FE-CMS-EDITOR-COVER-UPLOAD-DOUBLE-SUBMIT-001: uploadCover() shares the
// same savingRef guard as save()/workflow() -- the cover file input isn't
// disabled while a save-like mutation is in flight, so two same-tick
// cover-file changes both reached uploadMedia before this guard existed.
describe("EditorialWorkspace cover upload re-entrancy", () => {
  beforeEach(() => {
    panelServiceMock.content.mockResolvedValue({ results: [], count: 0, next: null, previous: null, summary: null });
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);
    panelServiceMock.uploadMedia.mockImplementation(() => new Promise(() => undefined));
  });

  it("collapses two same-turn cover-file changes to one upload", () => {
    const { container } = render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["cover"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(input!, { target: { files: [file] } });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(panelServiceMock.uploadMedia).toHaveBeenCalledTimes(1);
  });
});
