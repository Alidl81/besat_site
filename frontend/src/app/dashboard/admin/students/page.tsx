import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = { title: "دانش‌آموزان | پنل مدیریت" };

export default function RemovedStudentsPage() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="students" />;
}
