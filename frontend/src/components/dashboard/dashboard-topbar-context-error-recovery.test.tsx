import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// FE-DASH-CONTEXT-ERROR-RECOVERY-001: a failed panel/context fetch rendered a
// role=status error banner with no way to retry, and every "loading" scope
// placeholder (unit select, account-cluster role title) stayed on its
// "در حال دریافت..." copy forever instead of reflecting the real failure.
describe("dashboard topbar context error recovery", () => {
  it("shows a retry action and truthful failure copy, and recovers on retry", async () => {
    context.mockRejectedValueOnce(new Error("سرویس محدوده پنل در دسترس نیست."));

    render(
      <DashboardTopbar panel="admin" profileHref="/dashboard/admin/profile" mobileMenu={null} />,
    );

    await screen.findByText(/سرویس محدوده پنل در دسترس نیست/);
    expect(screen.getAllByText("دریافت واحدهای مجاز ناموفق بود.").length).toBeGreaterThan(0);
    expect(screen.getByText("دریافت نقش ناموفق بود")).toBeInTheDocument();
    expect(screen.queryByText("در حال دریافت واحدهای مجاز…")).not.toBeInTheDocument();

    context.mockResolvedValueOnce({
      user: { id: 1, full_name: "کاربر آزمون", role_display: "مدیر", avatar_url: null },
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(context).toHaveBeenCalledTimes(2);
    await screen.findByText("مدیر");
    expect(screen.queryByText(/سرویس محدوده پنل در دسترس نیست/)).not.toBeInTheDocument();
  });
});

// FE-DASH-AVATAR-MEDIA-ORIGIN-001: context.user.avatar_url is a backend-
// served media URL, the same possibly-wrong-host issue already fixed for
// every other media sink -- rendering it raw tripped CSP's img-src
// allowlist (this app's own origin only).
describe("dashboard topbar avatar media-origin normalization", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("normalizes a wrong-host avatar URL to this app's own origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, origin: "https://besat.example.com" },
    });
    context.mockResolvedValue({
      user: { id: 1, full_name: "کاربر آزمون", role_display: "مدیر", avatar_url: "http://localhost:3000/media/avatars/x.jpg" },
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

    const avatar = await screen.findByAltText("") as HTMLImageElement;
    expect(avatar.src).toBe("https://besat.example.com/media/avatars/x.jpg");
  });
});
