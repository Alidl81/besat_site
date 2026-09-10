import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard/admin",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/auth/auth-session", () => ({
  readBesatSession: () => null,
  getBesatSessionDisplayName: () => "حساب کاربری",
}));

const { context } = vi.hoisted(() => ({ context: vi.fn() }));

vi.mock("@/services/panel-service", () => ({
  panelService: { context },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-PANEL-TOPBAR-PROFILE-LABEL-001: below the `sm` breakpoint the header
// profile link's name/role text spans are `hidden`, and the fallback avatar
// is `alt=""` -- with no `aria-label`, the link's only accessible name on
// mobile was the single-letter fallback initial, so a keyboard/AT user could
// not tell it opens their profile or whose profile it is.
describe("DashboardTopbar profile link accessible name", () => {
  it("names the profile link with the account identity while context is still loading", () => {
    context.mockReturnValue(new Promise(() => {}));

    render(
      <DashboardTopbar panel="admin" profileHref="/dashboard/admin/profile" mobileMenu={null} />,
    );

    const link = screen.getByRole("link", { name: /پروفایل/ });
    expect(link).toHaveAttribute("href", "/dashboard/admin/profile");
    expect(link.getAttribute("aria-label")).toContain("حساب کاربری");
  });

  it("names the profile link with the resolved display name and role once context loads", async () => {
    context.mockResolvedValue({
      user: { id: 1, full_name: "کاربر آزمون", role_display: "مدیر کل", avatar_url: null },
      academic_years: [],
      selected_academic_year_id: null,
      units: [],
      selected_unit_id: null,
      children: [],
      selected_child_id: null,
      unread_notifications: 0,
      unread_messages: 0,
      current_date: "2026-09-06",
    });

    render(
      <DashboardTopbar panel="admin" profileHref="/dashboard/admin/profile" mobileMenu={null} />,
    );

    const link = await screen.findByRole("link", { name: /پروفایل.*کاربر آزمون.*مدیر کل/ });
    expect(link).toHaveAttribute("href", "/dashboard/admin/profile");
  });
});
