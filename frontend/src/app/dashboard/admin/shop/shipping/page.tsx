import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "روش‌های ارسال | پنل مدیریت",
};

export default function AdminShopShippingPage() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="shopShipping" />;
}
