import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "تنظیمات فروشگاه | پنل مدیریت",
};

export default function AdminShopSettingsPage() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="shopSettings" />;
}
