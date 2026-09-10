import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentItem: vi.fn(),
    contentCategories: vi.fn(),
    contentRevisions: vi.fn(),
    contentAction: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
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
      summary: { draft: 0, in_review: 1, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
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

import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";

const item = {
  id: "content-1",
  title: "عنوان زیر بررسی",
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
  status: "in_review",
  version: 1,
  slug: "content-1",
  author: null,
  updated_at: "2026-08-30T00:00:00Z",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// FE-CMS-REVIEW-REJECT-NOTE-FOCUS-001: activating "درخواست اصلاح" with a
// blank workflow-feedback textarea rendered a Persian field error, but the
// "بازخورد گردش کار" <details> group holding that textarea defaulted to
// closed and had no state-driven way to open, and the textarea never
// received focus -- the reviewer had no visible way to discover or reach
// the required field.
describe("EditorialWorkspace reject-note validation focus", () => {
  it("opens the workflow-feedback group and focuses the textarea on a blank reject", async () => {
    panelServiceMock.contentItem.mockResolvedValue(item);
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);

    render(<EditorialWorkspace authorRole="general_manager" />);

    fireEvent.click(screen.getAllByRole("button", { name: /ویرایش عنوان زیر بررسی/ })[0]);
    const rejectButton = await screen.findByRole("button", { name: "درخواست اصلاح" });

    fireEvent.click(rejectButton);

    // The blank-reject path also sets the exterior `errorText` banner
    // (its own separate role="alert"), so target the field-level one by
    // its exact message rather than assuming there's only one alert.
    const alert = await screen.findByText("برای درخواست اصلاح، بازخورد سردبیر را بنویسید.", { selector: '[role="alert"]' });
    const textarea = screen.getByPlaceholderText("برای درخواست اصلاح، این بازخورد الزامی است.");
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", alert.id);
    expect(panelServiceMock.contentAction).not.toHaveBeenCalled();
  });

  it("clears the field error once the reviewer types a note", async () => {
    panelServiceMock.contentItem.mockResolvedValue(item);
    panelServiceMock.contentCategories.mockResolvedValue([]);
    panelServiceMock.contentRevisions.mockResolvedValue([]);

    render(<EditorialWorkspace authorRole="general_manager" />);

    fireEvent.click(screen.getAllByRole("button", { name: /ویرایش عنوان زیر بررسی/ })[0]);
    const rejectButton = await screen.findByRole("button", { name: "درخواست اصلاح" });
    fireEvent.click(rejectButton);
    await screen.findByText("برای درخواست اصلاح، بازخورد سردبیر را بنویسید.", { selector: '[role="alert"]' });

    const textarea = screen.getByPlaceholderText("برای درخواست اصلاح، این بازخورد الزامی است.");
    fireEvent.change(textarea, { target: { value: "لطفاً منابع را اصلاح کنید." } });

    await waitFor(() =>
      expect(
        screen.queryByText("برای درخواست اصلاح، بازخورد سردبیر را بنویسید.", { selector: '[role="alert"]' }),
      ).not.toBeInTheDocument(),
    );
    expect(textarea).toHaveAttribute("aria-invalid", "false");
  });
});
