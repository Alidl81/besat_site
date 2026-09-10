import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardOverview } from "@/components/dashboard/panel-overviews";
import type { MediaDashboard, ParentDashboard } from "@/types/panel-api";

const { usePanelRequestMock } = vi.hoisted(() => ({ usePanelRequestMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/auth/auth-session", () => ({
  readBesatSession: () => ({ username: "qa", role: "unit_media" }),
}));
vi.mock("@/hooks/use-panel-request", () => ({ usePanelRequest: usePanelRequestMock }));
vi.mock("@/services/panel-service", () => ({ panelService: { dashboard: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-PANEL-SINGLE-EMPTY-DENSITY-001: the Media storage card and Parent
// today-schedule card kept the default 192px PanelEmpty while every
// adjacent Feed card in the same row already used the 96px compact variant
// (established by FE-PANEL-ADMIN-OVERVIEW-EMPTY-DENSITY-001) -- a visibly
// inconsistent, oversized blank canvas next to compact siblings.
describe("panel overview empty-state density", () => {
  it("renders the Media storage empty state using the compact variant", () => {
    const payload: MediaDashboard = {
      current_date: "2026-09-08",
      metrics: [],
      latest_content: [],
      messages: [],
      calendar: [],
      storage: null,
    };
    usePanelRequestMock.mockReturnValue({ data: payload, loading: false, error: null, reload: vi.fn() });

    render(<DashboardOverview panel="contentManager" data={payload as never} />);

    const empty = screen.getByText("اطلاعات فضای ذخیره‌سازی موجود نیست.");
    expect(empty.closest(".panel-empty-state-compact")).not.toBeNull();
    expect(empty.closest(".panel-empty-state")).toBeNull();
  });

  it("renders the Parent today-schedule empty state using the compact variant", () => {
    const payload: ParentDashboard = {
      current_date: "2026-09-08",
      metrics: [],
      selected_child: null,
      today_schedule: [],
      next_exam: null,
      current_assignment: null,
      attendance: null,
      events: [],
      teacher_messages: [],
      quick_links: [],
    };
    usePanelRequestMock.mockReturnValue({ data: payload, loading: false, error: null, reload: vi.fn() });

    render(<DashboardOverview panel="parents" data={payload as never} />);

    const empty = screen.getByText("برای امروز برنامه‌ای ثبت نشده است.");
    expect(empty.closest(".panel-empty-state-compact")).not.toBeNull();
    expect(empty.closest(".panel-empty-state")).toBeNull();
  });
});
