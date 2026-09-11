import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticPagesWorkspace } from "@/components/dashboard/legacy-admin-workspaces";

const { useCollection } = vi.hoisted(() => ({ useCollection: vi.fn() }));

vi.mock("@/components/crud/use-collection", () => ({ useCollection }));
vi.mock("@/lib/data/repositories", () => ({
  homeSlidesRepository: {},
  staffRepository: {},
  staticPagesRepository: {},
}));

beforeEach(() => {
  useCollection.mockReturnValue({
    items: [{
      id: "about-1",
      slug: "about",
      title: "درباره ما",
      body_html: "<p>معرفی</p>",
      meta_description: null,
      is_published: true,
      created_at: "2026-09-11T00:00:00Z",
      updated_at: "2026-09-11T00:00:00Z",
    }],
    loading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reload: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("static page manager capability contract", () => {
  it("does not advertise unsupported arbitrary page creation", () => {
    render(<StaticPagesWorkspace />);

    expect(screen.getByRole("heading", { name: "صفحه درباره ما" })).toBeInTheDocument();
    expect(screen.getByText(/فقط صفحه از پیش تعریف‌شده درباره ما/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "صفحه جدید" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "ویرایش درباره ما" })).toHaveLength(2);
  });
});
