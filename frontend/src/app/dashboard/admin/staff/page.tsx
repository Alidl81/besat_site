import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = { title: "کادر مدرسه | پنل مدیریت" };

export default function RemovedStaffPage() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="staff" />;
}
