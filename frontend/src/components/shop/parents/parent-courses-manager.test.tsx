import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParentCoursesManager } from "@/components/shop/parents/parent-courses-manager";

const { requestImpl } = vi.hoisted(() => ({ requestImpl: vi.fn() }));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

vi.mock("@/services/shop-account-service", () => ({ getMyCourses: vi.fn() }));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-PANEL-PARENT-ADDRESSES-ERROR-RETRY-001: see
// parent-addresses-manager.test.tsx -- identical no-retry defect, same
// shared PanelError fix.
describe("parent courses collection error retry", () => {
  it("offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ParentCoursesManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
