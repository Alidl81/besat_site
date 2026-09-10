import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentOrdersManager } from "@/components/shop/parents/parent-orders-manager";

const { requestImpl } = vi.hoisted(() => ({ requestImpl: vi.fn() }));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

vi.mock("@/services/shop-account-service", () => ({ getMyOrders: vi.fn() }));

const order = {
  order_number: "B-10",
  item_count: 1,
  total_amount: 100000,
  status: "paid",
};

beforeEach(() => {
  requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [order] }, reload: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-DASH-RTL-SHOP-ORDER-ACTION-001: identical table shape/defect as
// shop-orders-manager.tsx -- the sole row action sat entirely outside the
// visible panel-table-scroll wrapper at 390px. Same sticky-column fix.
describe("parent orders action column stickiness", () => {
  it("marks the actions header and each row's actions cell as sticky", () => {
    render(<ParentOrdersManager />);

    const actionLink = screen.getByRole("link", { name: "مشاهده جزئیات" });
    const actionsCell = actionLink.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    const actionsHeader = headerRow.lastElementChild;
    expect(actionsHeader).toHaveClass("panel-table-action-sticky");
  });
});

// FE-PANEL-PARENT-ADDRESSES-ERROR-RETRY-001: see
// parent-addresses-manager.test.tsx -- identical no-retry defect, same
// shared PanelError fix.
describe("parent orders collection error retry", () => {
  it("offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ParentOrdersManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
