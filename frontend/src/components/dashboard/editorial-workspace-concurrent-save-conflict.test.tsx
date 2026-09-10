import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const { panelServiceMock } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentItem: vi.fn(),
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
  title: "عنوان اول",
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

// FE-CMS-EDITOR-CONCURRENT-SAVE-LOSS-001: end-to-end check that this
// already-built frontend conflict UI (getConflict()/applyFailure() in
// editorial-workspace.tsx) actually activates against the exact 409 shape
// the backend now sends (backend/apps/content/cms.py's
// _conflict_response()) -- {"code": "content_conflict", "current": {id,
// version, updated_at, status}} -- rather than only being exercised by
// backend-side tests in isolation.
describe("EditorialWorkspace concurrent-save conflict", () => {
  it("shows the version-conflict alert instead of silently applying a stale save, and recovers via loadLatest", async () => {
    panelServiceMock.content.mockResolvedValue({ results: [], count: 0, next: null, previous: null, summary: null });
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);
    panelServiceMock.createContent.mockResolvedValue(saved);
    const conflictError = new ApiError({
      message: "درخواست توسط بک‌اند پذیرفته نشد.",
      status: 409,
      code: "content_conflict",
      detail: {
        code: "content_conflict",
        current: { id: "content-1", version: 2, updated_at: "2026-08-30T01:00:00Z", status: "draft" },
      },
    });
    panelServiceMock.updateContent.mockRejectedValueOnce(conflictError);
    panelServiceMock.contentItem.mockResolvedValue({ ...saved, title: "عنوان تب دیگر", version: 2 });

    render(<EditorialWorkspace authorRole="general_manager" />);
    fireEvent.click(screen.getByRole("button", { name: /محتوای جدید · ساده/ }));

    const titleInput = screen.getByPlaceholderText("عنوان دقیق و خوانای محتوا را بنویسید");
    fireEvent.change(titleInput, { target: { value: "عنوان اول" } });
    const form = screen.getByRole("button", { name: /ذخیره/ }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => expect(panelServiceMock.createContent).toHaveBeenCalledTimes(1));

    fireEvent.change(titleInput, { target: { value: "عنوان دوم -- نسخه قدیمی" } });
    fireEvent.submit(form!);

    await waitFor(() => expect(panelServiceMock.updateContent).toHaveBeenCalledTimes(1));
    // applyFailure() also sets a generic errorText alert alongside the
    // conflict-specific section, so more than one role="alert" element is
    // present -- match the conflict section's own distinctive text instead
    // of role+name (findByRole would throw "multiple elements found").
    await screen.findByText(/نسخه دیگری از این محتوا/);

    // loadLatest() confirms discarding the unsaved (dirty) local draft
    // before fetching the server's current version.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "دریافت نسخه جدید از سرور" }));
    await waitFor(() => expect(panelServiceMock.contentItem).toHaveBeenCalledWith("content-1"));
  });
});
