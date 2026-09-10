import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardPages } from "@/components/dashboard/dashboard-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/auth/login-service", () => ({ destroySession: vi.fn() }));
vi.mock("@/lib/auth/auth-session", () => ({ clearBesatSession: vi.fn() }));

import { DashboardMobileMenu } from "@/components/dashboard/dashboard-mobile-menu";

afterEach(() => cleanup());

// FE-DASH-MOBILE-MENU-LABEL-001: the trigger's accessible name stayed
// "باز کردن منو" (open menu) even once aria-expanded was already true --
// contradicting its own expanded state and the drawer's own close button's
// "بستن منو" naming. The trigger now toggles and derives its name from
// `open`, matching the same rapid-reopen scenario Codex's own evidence used.
describe("DashboardMobileMenu trigger name tracks open state", () => {
  it("derives the trigger's accessible name from open state across an open/close/reopen cycle", async () => {
    render(<DashboardMobileMenu data={dashboardPages.admin} activeKey="overview" />);

    const trigger = screen.getByRole("button", { name: "باز کردن منو" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAccessibleName("بستن منو");

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAccessibleName("باز کردن منو");

    // Rapid reopen: the name must keep tracking state, not get stuck on a
    // stale value from an earlier render.
    await act(async () => {
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      fireEvent.click(trigger);
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAccessibleName("بستن منو");
  });
});
