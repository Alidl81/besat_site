import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "دسته‌بندی‌های فروشگاه | پنل مدیریت",
};

export default function AdminShopCategoriesPage() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="shopCategories" />;
}
