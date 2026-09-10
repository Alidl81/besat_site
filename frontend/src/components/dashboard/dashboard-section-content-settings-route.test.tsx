import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardSectionContent } from "@/components/dashboard/dashboard-section-content";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/auth/auth-session", () => ({
  readBesatSession: () => ({ role: "general_manager", unitId: null }),
}));

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => <div>{name}</div>,
}));

vi.mock("@/components/crud/units-manager", () => ({ UnitsManager: stub("UnitsManager") }));
vi.mock("@/components/crud/departments-manager", () => ({ DepartmentsManager: stub("DepartmentsManager") }));
vi.mock("@/components/crud/users-manager", () => ({ UsersManager: stub("UsersManager") }));
vi.mock("@/components/crud/gallery-manager", () => ({ GalleryManager: stub("GalleryManager") }));
vi.mock("@/components/virtual-tour/virtual-tour-manager", () => ({ VirtualTourManager: stub("VirtualTourManager") }));
vi.mock("@/components/crud/messaging-panel", () => ({ MessagingPanel: stub("MessagingPanel") }));
vi.mock("@/components/crud/parent-views", () => ({ ParentProgramsView: stub("ParentProgramsView") }));
vi.mock("@/components/dashboard/panel-profile-content", () => ({ PanelProfileContent: stub("PanelProfileContent") }));
vi.mock("@/components/dashboard/editorial-workspace", () => ({ EditorialWorkspace: stub("EditorialWorkspace") }));
vi.mock("@/components/dashboard/events-calendar", () => ({ EventsCalendar: stub("EventsCalendar") }));
vi.mock("@/components/dashboard/parent-children-workspace", () => ({ ParentChildrenWorkspace: stub("ParentChildrenWorkspace") }));
vi.mock("@/components/dashboard/registration-workspace", () => ({ RegistrationWorkspace: stub("RegistrationWorkspace") }));
vi.mock("@/components/dashboard/panel-request-state", () => ({ PanelEmpty: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("@/components/shop/parents/parent-addresses-manager", () => ({ ParentAddressesManager: stub("ParentAddressesManager") }));
vi.mock("@/components/shop/parents/parent-courses-manager", () => ({ ParentCoursesManager: stub("ParentCoursesManager") }));
vi.mock("@/components/shop/parents/parent-order-detail-manager", () => ({ ParentOrderDetailManager: stub("ParentOrderDetailManager") }));
vi.mock("@/components/shop/parents/parent-orders-manager", () => ({ ParentOrdersManager: stub("ParentOrdersManager") }));
vi.mock("@/components/shop/admin/shop-categories-manager", () => ({ ShopCategoriesManager: stub("ShopCategoriesManager") }));
vi.mock("@/components/shop/admin/shop-enrollments-manager", () => ({ ShopEnrollmentsManager: stub("ShopEnrollmentsManager") }));
vi.mock("@/components/shop/admin/shop-orders-manager", () => ({ ShopOrdersManager: stub("ShopOrdersManager") }));
vi.mock("@/components/shop/admin/shop-products-manager", () => ({ ShopProductsManager: stub("ShopProductsManager") }));
vi.mock("@/components/shop/admin/shop-settings-manager", () => ({ ShopSettingsManager: stub("ShopSettingsManager") }));
vi.mock("@/components/shop/admin/shop-shipping-manager", () => ({ ShopShippingManager: stub("ShopShippingManager") }));
vi.mock("@/components/dashboard/supplementary-workspaces", () => ({
  ParentRegistrationWorkspace: stub("ParentRegistrationWorkspace"),
  ServicesWorkspace: stub("ServicesWorkspace"),
  SettingsWorkspace: stub("SettingsWorkspace"),
}));

afterEach(() => cleanup());

// FE-PANEL-ADMIN-SETTINGS-UNWIRED-001: the admin "settings" route rendered a
// hardcoded PanelEmpty stub even though SettingsWorkspace (organization
// name/academic-year/notification settings) was already fully implemented
// -- the menu entry always advertised this as a real route.
describe("DashboardSectionContent admin settings route", () => {
  it("renders SettingsWorkspace, not the empty-section placeholder", () => {
    render(<DashboardSectionContent panel="admin" sectionKey="settings" roleTitle="مدیر مجموعه" />);

    expect(screen.getByText("SettingsWorkspace")).toBeInTheDocument();
    expect(screen.queryByText("تنظیمات مدیریتی هنوز در دسترس نیست.")).not.toBeInTheDocument();
    expect(screen.queryByText("بخش درخواستی در دسترس نیست.")).not.toBeInTheDocument();
  });
});
