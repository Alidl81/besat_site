import { describe, expect, it } from "vitest";
import { redirectPathForRole, rolesForDashboardSegment } from "@/lib/auth/auth-session";

describe("redirectPathForRole", () => {
  it("sends general_manager to the admin shell", () => {
    expect(redirectPathForRole("general_manager")).toBe("/dashboard/admin");
  });

  // Regression for FE-UNIT-MANAGER-ROUTING-001: every item in the admin
  // shell's menu is general_manager-only (dashboard-data.ts), so landing
  // unit_manager there was a dead end with almost nothing usable.
  it("sends unit_manager to the content-manager shell, not admin", () => {
    expect(redirectPathForRole("unit_manager")).toBe("/dashboard/content-manager");
  });

  it("sends unit_media to the content-manager shell", () => {
    expect(redirectPathForRole("unit_media")).toBe("/dashboard/content-manager");
  });

  it("sends parent to the parents shell", () => {
    expect(redirectPathForRole("parent")).toBe("/dashboard/parents");
  });
});

describe("rolesForDashboardSegment", () => {
  // Regression for FE-UNIT-MANAGER-ROUTING-001: this used to include
  // unit_manager, letting DashboardGuard admit a role into a shell whose
  // menu items are all general_manager-only.
  it("only admits general_manager to the admin segment", () => {
    expect(rolesForDashboardSegment("admin")).toEqual(["general_manager"]);
  });

  it("admits general_manager, unit_manager, and unit_media to content-manager", () => {
    expect(rolesForDashboardSegment("content-manager")).toEqual([
      "general_manager",
      "unit_manager",
      "unit_media",
    ]);
  });

  it("admits only parent to the parents segment", () => {
    expect(rolesForDashboardSegment("parents")).toEqual(["parent"]);
  });
});
