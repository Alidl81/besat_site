import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParentChildrenWorkspace } from "@/components/dashboard/parent-children-workspace";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard/parents/children",
  useSearchParams: () => new URLSearchParams(""),
}));

const { childrenMock, detailMock } = vi.hoisted(() => ({
  childrenMock: vi.fn(),
  detailMock: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: { parentChildren: childrenMock, parentChild: detailMock },
}));

const child = {
  id: 31,
  full_name: "نگار رضایی",
  grade_title: "پایه هفتم",
  is_active: true,
  avatar_url: null,
};

const detail = {
  ...child,
  major: null,
  unit_title: null,
  average: null,
  class_rank: null,
  grade_rank: null,
  teachers: [],
  attendance: null,
  latest_grades: [],
  quick_links: [],
  counselor_message: null,
  exams: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-PANEL-PARENT-CHILDREN-DETAIL-RETRY-DEAD-001: the detail-error retry
// button used to be wired to a hand-rolled `setDetailVersion((v) => v + 1)`
// state bump, driving a separate hand-rolled useEffect -- Codex's evidence
// showed real click, keyboard and direct-handler activation of that retry
// all produced no follow-up request at any width. Replaced with the same
// shared usePanelRequest hook already used for the children list.
describe("ParentChildrenWorkspace detail error retry", () => {
  it("retries the failed detail fetch and recovers on click", async () => {
    childrenMock.mockResolvedValue([child]);
    detailMock.mockRejectedValueOnce(new Error("دریافت پرونده فرزند انجام نشد."));
    detailMock.mockResolvedValueOnce(detail);

    render(<ParentChildrenWorkspace />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("دریافت پرونده فرزند انجام نشد.");
    expect(detailMock).toHaveBeenCalledTimes(1);

    fireEvent.click(within(alert).getByRole("button", { name: "تلاش دوباره" }));

    await screen.findByText("نگار رضایی");
    expect(detailMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
