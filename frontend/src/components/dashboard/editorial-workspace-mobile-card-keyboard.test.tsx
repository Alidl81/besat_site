import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { panelServiceMock } = vi.hoisted(() => ({
  panelServiceMock: {
    content: vi.fn(),
    contentItem: vi.fn(),
    contentCategories: vi.fn(),
    contentRevisions: vi.fn(),
    createContent: vi.fn(),
    updateContent: vi.fn(),
  },
}));

vi.mock("@/services/panel-service", () => ({ panelService: panelServiceMock }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({
    data: {
      results: [itemA, itemB],
      count: 2,
      next: null,
      previous: null,
      summary: { draft: 2, in_review: 0, changes_requested: 0, approved: 0, published: 0, scheduled: 0, archived: 0 },
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

function makeItem(id: string, title: string) {
  return {
    id,
    title,
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
    slug: id,
    author: null,
    updated_at: "2026-08-30T00:00:00Z",
  };
}

const itemA = makeItem("content-1", "کارت اول");
const itemB = makeItem("content-2", "کارت دوم");

// Both the mobile <article> and the desktop <tr> for the same item render
// simultaneously in jsdom (it doesn't apply the compiled Tailwind CSS that
// hides one via `md:hidden`/`hidden md:block`) -- picking the button whose
// closest ancestor is the mobile <article>, not the desktop <tr>.
function getMobileCardButton(name: string) {
  const buttons = screen.getAllByRole("button", { name });
  const mobile = buttons.find((button) => button.closest("article"));
  if (!mobile) throw new Error(`no mobile card button found for "${name}"`);
  return mobile;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// FE-PANEL-MEDIA-REVIEW-MOBILE-CARD-KEYBOARD-001: the mobile <article>
// review card had only onClick -- no tabIndex/role/keyboard handler at
// all, unlike the desktop <tr> for the exact same list, which is
// keyboard-reachable. A keyboard/AT user on mobile could not select an
// item at all.
describe("EditorialWorkspace mobile card keyboard selection", () => {
  it("exposes the mobile card as a keyboard-focusable, selectable control", () => {
    render(<EditorialWorkspace authorRole="general_manager" />);

    const cardA = getMobileCardButton("مشاهده کارت اول");
    expect(cardA).toHaveAttribute("tabindex", "0");
    expect(cardA).toHaveAttribute("aria-pressed", "true");

    const cardB = getMobileCardButton("مشاهده کارت دوم");
    expect(cardB).toHaveAttribute("tabindex", "0");
    expect(cardB).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the not-yet-selected card on Enter", () => {
    render(<EditorialWorkspace authorRole="general_manager" />);

    const cardB = getMobileCardButton("مشاهده کارت دوم");
    expect(cardB).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(cardB, { key: "Enter" });

    expect(cardB).toHaveAttribute("aria-pressed", "true");
  });

  it("does not reselect the card when Enter is pressed on its own nested edit button", () => {
    render(<EditorialWorkspace authorRole="general_manager" />);

    const cardB = getMobileCardButton("مشاهده کارت دوم");
    const editButtonB = getMobileCardButton("ویرایش کارت دوم");

    // cardB starts unselected; pressing Enter on ITS OWN nested edit
    // button must not select it as a side effect of the keydown bubbling.
    expect(cardB).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(editButtonB, { key: "Enter" });
    expect(cardB).toHaveAttribute("aria-pressed", "false");
  });
});
