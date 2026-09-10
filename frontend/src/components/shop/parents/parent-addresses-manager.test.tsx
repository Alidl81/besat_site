import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentAddressesManager } from "@/components/shop/parents/parent-addresses-manager";

const { service, requestImpl } = vi.hoisted(() => ({
  service: { getMyAddresses: vi.fn(), deleteAddress: vi.fn() },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/shop-account-service", () => service);
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/shop/address-form", () => ({ AddressForm: () => null }));
vi.mock("@/components/crud/crud-ui", async () => {
  const React = await import("react");
  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />;
  return {
    CrudSection: ({ action, children }: { action?: React.ReactNode; children: React.ReactNode }) => <section>{action}{children}</section>,
    EmptyState: ({ text }: { text: string }) => <p>{text}</p>,
    PrimaryButton: Button,
    Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
    ConfirmDialog: ({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void }) => open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>حذف</button>
        <button type="button" onClick={onCancel}>انصراف</button>
      </div>
    ) : null,
  };
});

const address = {
  id: 21,
  recipient_full_name: "والد نمونه",
  phone: "09120000000",
  province: "تهران",
  city: "تهران",
  address_line1: "خیابان نمونه",
  address_line2: "",
  postal_code: "1234567890",
  is_default: true,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  requestImpl.mockReturnValue({ loading: false, error: null, data: [address], reload: vi.fn() });
  service.deleteAddress.mockReturnValue(new Promise<never>(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-PARENT-ADDRESS-DELETE-DOUBLE-SUBMIT-001: handleDelete had no
// synchronous in-flight guard, so two same-tick delete confirmations both
// reached deleteAddress.
describe("parent address destructive mutation boundary", () => {
  it("collapses two same-tick delete confirmations to one request", async () => {
    render(<ParentAddressesManager />);
    fireEvent.click(screen.getByRole("button", { name: "حذف آدرس والد نمونه" }));
    const dialog = screen.getByRole("dialog", { name: "حذف آدرس" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
      await Promise.resolve();
    });

    expect(service.deleteAddress).toHaveBeenCalledTimes(1);
  });
});

// FE-PANEL-PARENT-ADDRESSES-ERROR-RETRY-001: a failed initial load rendered
// plain text with no retry action, even though usePanelRequest already
// returns `reload` -- this is a key checkout-prerequisite panel, so a
// transient failure required a full page reload to recover.
describe("parent addresses collection error retry", () => {
  it("offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ParentAddressesManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
